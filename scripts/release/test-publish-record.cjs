const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const publish = require('./publish-record.cjs')

test('immutable publication requires absent identity, all evidence, final lock and exact tag source', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'release-publish-'))
  const original = process.cwd(), oldAttempt = process.env.GITHUB_RUN_ATTEMPT
  process.chdir(tmp); process.env.GITHUB_RUN_ATTEMPT = '1'
  try {
    fs.mkdirSync('.local/release', { recursive: true })
    const sha = 'a'.repeat(40)
    const record = { releaseId: 'web-v2-10-1', inputs: { publicSha: sha }, build: { repository: 'example/public' } }
    fs.writeFileSync('.local/release/release.json', JSON.stringify(record))
    const assets = ['record-provenance.jsonl', 'image-provenance.jsonl', 'baked-content.json', 'dataset-snapshot.json', '66archive-web.tar']
    for (const file of assets) fs.writeFileSync('.local/release/' + file, 'fixture')
    let immutable = true, commit = sha, uploaded = 0, finalized = false, collision = false, networkFailure = false
    const absent = async () => {
      if (networkFailure) throw Object.assign(new Error('network error'), { status: 503 })
      if (collision) return { data: {} }
      throw Object.assign(new Error('missing'), { status: 404 })
    }
    const github = { request: async () => ({ data: { enabled: true } }), rest: { git: { getRef: absent }, repos: {
      getReleaseByTag: absent,
      createRelease: async args => { assert.equal(args.draft, true); assert.equal(args.target_commitish, sha); return { data: { id: 10 } } },
      uploadReleaseAsset: async () => { assert.equal(finalized, false); uploaded++ },
      updateRelease: async () => { assert.equal(uploaded, 6); finalized = true; return { data: { immutable } } },
      getCommit: async () => ({ data: { sha: commit } }),
    } } }
    const run = () => { uploaded = 0; finalized = false; return publish({ github, context: { runId: 10, sha, repo: { owner: 'example', repo: 'public' } } }) }
    await run()
    collision = true; await assert.rejects(run, /refusing overwrite/); assert.equal(uploaded, 0)
    collision = false; networkFailure = true; await assert.rejects(run, /network error/)
    networkFailure = false; immutable = false; await assert.rejects(run, /not immutable/)
    immutable = true; commit = 'b'.repeat(40); await assert.rejects(run, /unexpected source/)
    fs.unlinkSync('.local/release/record-provenance.jsonl'); await assert.rejects(run); assert.equal(uploaded, 0)
  } finally {
    process.chdir(original)
    if (oldAttempt === undefined) delete process.env.GITHUB_RUN_ATTEMPT
    else process.env.GITHUB_RUN_ATTEMPT = oldAttempt
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
