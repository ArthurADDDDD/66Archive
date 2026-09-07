const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const compare = require('./compare-shadow.cjs')

test('immutable shadow digest gate', async () => {
  const original = process.cwd()
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-test-'))
  const oldTemp = process.env.RUNNER_TEMP
  process.chdir(tmp)
  process.env.RUNNER_TEMP = tmp
  try {
    fs.mkdirSync('.local/release', { recursive: true })
    const current = { publicSha: 'a'.repeat(40), digest: 'sha256:' + 'b'.repeat(64), snapshotSha256: 'c'.repeat(64) }
    fs.writeFileSync('.local/release/image-report.json', JSON.stringify(current))
    let artifacts = []
    let previous = current
    let output
    const github = {
      paginate: async () => artifacts,
      rest: { actions: { listArtifactsForRepo() {}, downloadArtifact: async () => {
        fs.writeFileSync('image-report.json', JSON.stringify(previous))
        execFileSync('zip', ['-q', 'previous.zip', 'image-report.json'])
        return { data: fs.readFileSync('previous.zip') }
      } } },
    }
    const invoke = () => compare({ github, context: { repo: { owner: 'example', repo: 'public' } }, core: { setOutput: (_, v) => { output = v } } })
    await invoke()
    assert.equal(output, 'false')
    artifacts = [{ id: 1, expired: false, workflow_run: { head_sha: current.publicSha, head_branch: 'main' } }]
    await invoke()
    assert.equal(output, 'true')
    previous = { ...current, digest: 'sha256:' + 'd'.repeat(64) }
    await assert.rejects(invoke, /different image\/snapshot digest/)
    previous = { ...current, snapshotSha256: 'e'.repeat(64) }
    await assert.rejects(invoke, /different image\/snapshot digest/)
    artifacts[0].expired = true
    await assert.rejects(invoke, /expired/)
    artifacts[0].expired = false
    artifacts[0].workflow_run.head_branch = 'untrusted'
    await assert.rejects(invoke, /unexpected source/)
    github.paginate = async () => { throw new Error('API unavailable') }
    await assert.rejects(invoke, /API unavailable/)
  } finally {
    process.chdir(original)
    if (oldTemp === undefined) delete process.env.RUNNER_TEMP
    else process.env.RUNNER_TEMP = oldTemp
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
