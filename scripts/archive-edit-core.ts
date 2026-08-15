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

export function backupsToPrune(names: string[], keep = 7) {
  if (!Number.isInteger(keep) || keep < 1) throw new Error('备份保留数量必须是正整数')
  return names
    .filter((value) => /^archive-\d{8}T\d{6}Z\.dump$/.test(value))
    .sort()
    .reverse()
    .slice(keep)
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
