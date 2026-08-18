import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import { execFileSync } from 'node:child_process'

type EntryRecord = Record<string, unknown> & { id: string }

export type LocatedEntry = {
  absolutePath: string
  relativePath: string
  entries: EntryRecord[]
  entry: EntryRecord
}

function readEntries(file: string): EntryRecord[] {
  const parsed = yaml.load(fs.readFileSync(file, 'utf8')) ?? []
  const values = Array.isArray(parsed) ? parsed : [parsed]
  return values.filter((value): value is EntryRecord => {
    return typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string'
  })
}

export function findEntry(root: string, entryId: string): LocatedEntry {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,299}$/.test(entryId)) {
    throw new Error('entry id 格式无效')
  }
  const directory = path.join(root, 'data', 'entries')
  const matches: LocatedEntry[] = []
  for (const name of fs.readdirSync(directory).filter((value) => /\.ya?ml$/.test(value)).sort()) {
    const absolutePath = path.join(directory, name)
    const entries = readEntries(absolutePath)
    for (const entry of entries) {
      if (entry.id === entryId) {
        matches.push({ absolutePath, relativePath: path.posix.join('data', 'entries', name), entries, entry })
      }
    }
  }
  if (matches.length === 0) throw new Error(`找不到档案条目：${entryId}`)
  if (matches.length > 1) throw new Error(`档案条目 id 重复，拒绝编辑：${entryId}`)
  return matches[0]
}

/**
 * 全部 entries 文件里的 id 集合。
 *
 * 新增条目要先确认「这个 id 在档案里任何一个文件都不存在」。用 `findEntry` 抛错来
 * 反推"不存在"是靠错误消息判断，换一句文案就静默失效；这里直接给出集合。
 */
export function allEntryIds(root: string): Set<string> {
  const directory = path.join(root, 'data', 'entries')
  const ids = new Set<string>()
  for (const name of fs.readdirSync(directory).filter((value) => /\.ya?ml$/.test(value))) {
    for (const entry of readEntries(path.join(directory, name))) ids.add(entry.id)
  }
  return ids
}

function entriesById(entries: EntryRecord[], label: string) {
  const result = new Map<string, EntryRecord>()
  for (const entry of entries) {
    if (result.has(entry.id)) throw new Error(`${label} 中存在重复 entry id：${entry.id}`)
    result.set(entry.id, entry)
  }
  return result
}

export function assertOnlyTargetEntryChanged(beforeFile: string, afterFile: string, targetId: string) {
  const before = entriesById(readEntries(beforeFile), '修改前文件')
  const after = entriesById(readEntries(afterFile), '修改后文件')
  if (before.size !== after.size || [...before.keys()].some((id) => !after.has(id))) {
    throw new Error('不允许在安全编辑流程中新增、删除或改写 entry id')
  }
  const changed = [...before.keys()].filter((id) => JSON.stringify(before.get(id)) !== JSON.stringify(after.get(id)))
  if (changed.length === 0) throw new Error('文件内容没有发生档案字段变化')
  if (changed.length !== 1 || changed[0] !== targetId) {
    throw new Error(`一次只能修改目标条目 ${targetId}；实际变化：${changed.join('、')}`)
  }
}

/**
 * 新增条目的守卫。
 *
 * 与 `assertOnlyTargetEntryChanged` 是**对偶**关系，不是它的放宽版：那道守卫要求
 * id 集合不变、恰好一条内容变化；这道要求 id 集合恰好多出目标那一个、
 * 且**原有每一条都逐字节等价**。两道各管一条路，谁都不给对方开口子——
 * 新增路径能改到已有条目，正是这套流程最不该发生的事。
 *
 * `beforeFile` 传 null 表示目标文件本来不存在（当月第一条），这时要求结果里
 * 有且只有目标这一条。
 */
export function assertOnlyTargetEntryAdded(beforeFile: string | null, afterFile: string, targetId: string) {
  const before = beforeFile === null ? new Map<string, EntryRecord>() : entriesById(readEntries(beforeFile), '新增前文件')
  const after = entriesById(readEntries(afterFile), '新增后文件')

  if (before.has(targetId)) throw new Error(`条目已存在，不能作为新增：${targetId}`)
  if (!after.has(targetId)) throw new Error(`新增后的文件里找不到目标条目：${targetId}`)

  const added = [...after.keys()].filter((id) => !before.has(id))
  if (added.length !== 1 || added[0] !== targetId) {
    throw new Error(`一次只能新增目标条目 ${targetId}；实际新增：${added.join('、') || '无'}`)
  }
  const removed = [...before.keys()].filter((id) => !after.has(id))
  if (removed.length > 0) throw new Error(`不允许在新增流程中删除条目：${removed.join('、')}`)

  const changed = [...before.keys()].filter((id) => JSON.stringify(before.get(id)) !== JSON.stringify(after.get(id)))
  if (changed.length > 0) throw new Error(`新增条目时不允许改动已有条目：${changed.join('、')}`)
}

/**
 * 一条新条目该写进哪个文件。
 *
 * `data/entries/` 的历史命名并不统一（`2015-douyu-live.yaml`、`2010-2015-youku-video.yaml`
 * 这些早期文件是按时期切的），但**新增只走这一种**：按年月 + 平台 + 类型。
 * 允许挑文件就等于把路径变成了参数，而这是唯一会写公开仓 data/** 的自动化路径。
 */
export function entriesFileFor(date: string, platform: string, type: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`日期格式无效：${date}`)
  if (!/^[a-z]+$/.test(platform)) throw new Error(`平台格式无效：${platform}`)
  if (type !== 'live' && type !== 'video') throw new Error(`类型无效：${type}`)
  return path.posix.join('data', 'entries', `${date.slice(0, 7)}-${platform}-${type}.yaml`)
}

/** 目标文件里已有条目的缩进（`- id:` 前的空白）。新文件用同平台最近一个文件的风格。 */
export function entryIndentOf(file: string): string {
  if (!fs.existsSync(file)) return ''
  const match = /^([ \t]*)-\s+id:/m.exec(fs.readFileSync(file, 'utf8'))
  return match ? match[1] : ''
}

export function assertChangedPaths(paths: string[], expectedPath: string) {
  const normalized = [...new Set(paths.map((value) => value.replaceAll('\\', '/')).filter(Boolean))].sort()
  if (normalized.length !== 1 || normalized[0] !== expectedPath) {
    throw new Error(`一次只能修改 ${expectedPath}；实际变化：${normalized.join('、') || '无'}`)
  }
}

export function gitChangedPaths(root: string) {
  const git = (args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim().split('\n')
  return [
    ...git(['diff', '--name-only', '--no-renames', 'HEAD']),
    ...git(['ls-files', '--others', '--exclude-standard']),
  ].filter((value) => value && value !== 'node_modules' && !value.startsWith('node_modules/'))
}

export function normalizeEvidence(value: string) {
  const normalized = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!normalized) throw new Error('依据不能为空')
  if (normalized.length > 500) throw new Error('依据不能超过 500 个字符')
  return normalized
}

export function commitMessage(entryId: string, evidence: string, changeId: string) {
  return [
    `data(archive): correct ${entryId}`,
    '',
    `Archive-Entry: ${entryId}`,
    `Archive-Change-ID: ${changeId}`,
    `Archive-Evidence: ${normalizeEvidence(evidence)}`,
  ].join('\n')
}

/** Parse a small shell-like editor command, then execute it without a shell. */
export function parseEditorCommand(value: string): string[] {
  const result: string[] = []
  let current = ''
  let quote: 'single' | 'double' | null = null
  let escaped = false
  for (const character of value.trim()) {
    if (escaped) {
      current += character
      escaped = false
    } else if (character === '\\' && quote !== 'single') {
      escaped = true
    } else if (character === "'" && quote !== 'double') {
      quote = quote === 'single' ? null : 'single'
    } else if (character === '"' && quote !== 'single') {
      quote = quote === 'double' ? null : 'double'
    } else if (/\s/.test(character) && quote === null) {
      if (current) result.push(current)
      current = ''
    } else {
      current += character
    }
  }
  if (escaped || quote !== null) throw new Error('编辑器命令包含未闭合的引号或转义')
  if (current) result.push(current)
  if (result.length === 0) throw new Error('没有可用的编辑器命令')
  return result
}
