import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  assertChangedPaths,
  assertOnlyTargetEntryChanged,
  backupsToPrune,
  commitMessage,
  findEntry,
  gitChangedPaths,
  normalizeEvidence,
  parseEditorCommand,
} from './archive-edit-core'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-edit-test-'))
try {
  const entries = path.join(root, 'data', 'entries')
  fs.mkdirSync(entries, { recursive: true })
  const before = path.join(root, 'before.yaml')
  const after = path.join(root, 'after.yaml')
  const original = '- id: 2026-01-01-live-01\n  title: 原标题\n- id: 2026-01-02-live-01\n  title: 不变\n'
  fs.writeFileSync(path.join(entries, '2026.yaml'), original)
  fs.writeFileSync(before, original)
  fs.writeFileSync(after, original.replace('原标题', '核验后的标题'))

  assert.equal(findEntry(root, '2026-01-01-live-01').relativePath, 'data/entries/2026.yaml')
  assertOnlyTargetEntryChanged(before, after, '2026-01-01-live-01')
  assert.throws(() => assertOnlyTargetEntryChanged(before, after, '2026-01-02-live-01'), /一次只能修改目标条目/)
  assertChangedPaths(['data/entries/2026.yaml'], 'data/entries/2026.yaml')
  assert.throws(() => assertChangedPaths(['data/entries/2026.yaml', '.github/workflows/ci.yml'], 'data/entries/2026.yaml'), /一次只能修改/)
  assert.equal(normalizeEvidence('  原视频\n03:12  '), '原视频 03:12')
  assert.throws(() => normalizeEvidence(' \n '), /依据不能为空/)
  assert.match(commitMessage('entry-1', '来源页面', 'change-1'), /Archive-Evidence: 来源页面/)
  assert.deepEqual(parseEditorCommand('code --wait'), ['code', '--wait'])
  assert.deepEqual(parseEditorCommand("'Visual Studio Code' --wait"), ['Visual Studio Code', '--wait'])
  assert.throws(() => parseEditorCommand("code '"), /未闭合/)
  const backups = Array.from({ length: 9 }, (_, index) => `archive-20260815T00000${index}Z.dump`)
  assert.deepEqual(backupsToPrune([...backups, 'unrelated.txt']), [backups[1], backups[0]])

  const repository = path.join(root, 'repository')
  fs.mkdirSync(path.join(repository, 'data', 'entries'), { recursive: true })
  fs.writeFileSync(path.join(repository, '.gitignore'), 'node_modules/\n')
  fs.writeFileSync(path.join(repository, 'data', 'entries', '2026.yaml'), original)
  const git = (args: string[]) => execFileSync('git', args, { cwd: repository, stdio: 'ignore' })
  git(['init'])
  git(['config', 'user.name', 'archive-test'])
  git(['config', 'user.email', 'archive-test@example.invalid'])
  git(['add', '.'])
  git(['commit', '-m', 'fixture'])
  fs.writeFileSync(path.join(repository, 'data', 'entries', '2026.yaml'), original.replace('原标题', '新标题'))
  fs.writeFileSync(path.join(root, 'external-before.yaml'), original)
  assert.deepEqual(gitChangedPaths(repository), ['data/entries/2026.yaml'])
  console.log('archive-edit core tests passed')
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}
