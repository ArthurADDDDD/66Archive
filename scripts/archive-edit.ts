import { randomUUID } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import {
  assertChangedPaths,
  assertOnlyTargetEntryChanged,
  commitMessage,
  findEntry,
  gitChangedPaths,
  normalizeEvidence,
  parseEditorCommand,
} from './archive-edit-core'

const EXPECTED_ORIGIN = /(?:github\.com[/:])ArthurADDDDD\/66Archive(?:\.git)?$/i

function run(command: string, args: string[], cwd: string, capture = false) {
  const result = execFileSync(command, args, { cwd, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' })
  return capture ? result.trim() : ''
}

function git(cwd: string, args: string[], capture = false) {
  return run('git', args, cwd, capture)
}

function gitOptional(cwd: string, args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  if (result.error) throw result.error
  return result.status === 0 ? result.stdout.trim() : ''
}

function signingConfiguration(root: string): { key: string; format: string } | null {
  const key = gitOptional(root, ['config', '--get', 'user.signingkey'])
  const format = gitOptional(root, ['config', '--get', 'gpg.format'])
  if (!key && !format) {
    console.log('本机未配置 Git 签名；按 2026-08-15 决定以不签名提交继续。')
    return null
  }
  if (!key || !format) throw new Error('签名配置不完整：user.signingkey 与 gpg.format 必须同时配置或同时留空')
  if (format === 'ssh' && !gitOptional(root, ['config', '--get', 'gpg.ssh.allowedSignersFile'])) {
    throw new Error('SSH 签名缺少 gpg.ssh.allowedSignersFile，无法在本机执行 git verify-commit')
  }
  return { key, format }
}

function commitSigned(root: string, signing: { key: string; format: string } | null, message: string) {
  git(root, ['commit', ...(signing ? ['-S'] : []), '-m', message])
  if (signing) git(root, ['verify-commit', 'HEAD'])
}

async function main() {
  const entryId = process.argv[2]
  if (!entryId || process.argv.length !== 3) {
    console.error('Usage: npm run archive:edit -- <entryId>')
    process.exitCode = 64
    return
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,299}$/.test(entryId)) throw new Error('entry id 格式无效')

  const root = git(process.cwd(), ['rev-parse', '--show-toplevel'], true)
  const origin = git(root, ['remote', 'get-url', 'origin'], true)
  if (!EXPECTED_ORIGIN.test(origin)) throw new Error(`拒绝操作非权威公开仓 origin：${origin}`)
  const signing = signingConfiguration(root)
  git(root, ['fetch', '--prune', 'origin', 'main'])

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-edit-'))
  const beforeFile = `${temporaryRoot}.before.yaml`
  let worktreeAdded = false
  const prompt = readline.createInterface({ input, output })
  try {
    git(root, ['worktree', 'add', '--detach', temporaryRoot, 'origin/main'])
    worktreeAdded = true
    const sourceModules = path.join(root, 'node_modules')
    if (!fs.existsSync(sourceModules)) throw new Error('公开仓尚未安装 node_modules，请先运行 npm install')
    fs.symlinkSync(sourceModules, path.join(temporaryRoot, 'node_modules'), 'dir')

    const located = findEntry(temporaryRoot, entryId)
    fs.copyFileSync(located.absolutePath, beforeFile)
    console.log(`\n档案：${String(located.entry.title ?? entryId)}`)
    console.log(`文件：${located.relativePath}`)

    const editor = parseEditorCommand(process.env.ARCHIVE_EDITOR ?? process.env.VISUAL ?? process.env.EDITOR ?? 'vi')
    const edited = spawnSync(editor[0], [...editor.slice(1), located.absolutePath], { cwd: temporaryRoot, stdio: 'inherit' })
    if (edited.error) throw edited.error
    if (edited.status !== 0) throw new Error(`编辑器退出状态为 ${edited.status}`)

    const evidence = normalizeEvidence(await prompt.question('核验依据（必填，最多 500 字）：'))
    assertChangedPaths(gitChangedPaths(temporaryRoot), located.relativePath)
    assertOnlyTargetEntryChanged(beforeFile, located.absolutePath, entryId)
    run('npm', ['run', 'validate'], temporaryRoot)
    assertChangedPaths(gitChangedPaths(temporaryRoot), located.relativePath)

    console.log('\n========== 完整 before / after diff ==========')
    git(temporaryRoot, ['--no-pager', 'diff', '--no-ext-diff', '--color=always', '--', located.relativePath])
    console.log(signing
      ? '========== diff 结束；下一步将请求本机签名，取消请按 Ctrl-C =========='
      : '========== diff 结束；未配置签名，将直接提交并推送，取消请按 Ctrl-C ==========')

    const changeId = randomUUID()
    const message = commitMessage(entryId, evidence, changeId)
    git(temporaryRoot, ['add', '--', located.relativePath])
    commitSigned(temporaryRoot, signing, message)

    const base = git(temporaryRoot, ['rev-parse', 'HEAD^'], true)
    git(temporaryRoot, ['fetch', 'origin', 'main'])
    const latest = git(temporaryRoot, ['rev-parse', 'origin/main'], true)
    if (latest !== base) {
      const baseBlob = git(temporaryRoot, ['rev-parse', `${base}:${located.relativePath}`], true)
      const latestBlob = git(temporaryRoot, ['rev-parse', `${latest}:${located.relativePath}`], true)
      if (baseBlob !== latestBlob) throw new Error('main 上的目标文件已经变化，请重新运行并核验新版本')
      git(temporaryRoot, ['reset', '--soft', latest])
      console.log('\nmain 有无关更新；以下是基于最新 main 重建后的完整 diff：')
      git(temporaryRoot, ['--no-pager', 'diff', '--cached', '--no-ext-diff', '--color=always'])
      commitSigned(temporaryRoot, signing, message)
    }

    git(temporaryRoot, ['push', 'origin', 'HEAD:main'])
    console.log(`\n档案已落盘：${git(temporaryRoot, ['rev-parse', 'HEAD'], true)}`)
  } finally {
    prompt.close()
    if (worktreeAdded) {
      try { git(root, ['worktree', 'remove', '--force', temporaryRoot]) } catch { /* preserve original error */ }
    }
    fs.rmSync(temporaryRoot, { recursive: true, force: true })
    fs.rmSync(beforeFile, { force: true })
  }
}

main().catch((error) => {
  console.error(`\n安全编辑失败：${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
