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

/**
 * 明确的人工确认。只认整词 `yes`——回车、y、随手敲的任何东西都算中止。
 * 这条链路的终点是往公开仓 main 直接 push，宁可多问一次。
 */
async function confirm(prompt: { question: (q: string) => Promise<string> }, question: string): Promise<boolean> {
  const answer = await prompt.question(`\n${question} 输入 yes 继续，其它任何输入都会中止：`)
  return answer.trim().toLowerCase() === 'yes'
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
    console.log('========== diff 结束 ==========')

    /**
     * 这里必须**真的停下来等人**。
     *
     * 此前这一行写的是「取消请按 Ctrl-C」，但它后面没有任何等待窗口——紧接着就是
     * `git add` + commit + push。未配置签名时更是一路直达公开仓 main：diff 刚滚完，
     * 同一拍就已经推上去了，那句「取消请按 Ctrl-C」根本没有可按的时机。
     * 签名的情况还有硬件那一下能当确认，不签名的情况什么都没有。
     */
    if (!(await confirm(prompt, signing
      ? '确认提交（将请求本机签名）并推送到公开仓 main？'
      : '未配置签名，将直接提交并推送到公开仓 main。确认？'))) {
      console.log('已中止：没有提交，也没有推送。')
      return
    }

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
      // 基底换了，推上去的就不再是刚才确认过的那一份，所以要重新确认一次。
      if (!(await confirm(prompt, '基于最新 main 重建后的内容如上。确认推送？'))) {
        console.log('已中止：本地临时工作树会被清理，公开仓没有任何改动。')
        return
      }
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
