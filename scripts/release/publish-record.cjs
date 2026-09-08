// Publish once, attach all evidence while draft, then require an immutable release.
module.exports = async ({ github, context }) => {
  const fs = require('node:fs')
  const path = require('node:path')
  const record = JSON.parse(fs.readFileSync('.local/release/release.json', 'utf8'))
  const tag = `web-v2-${context.runId}-${process.env.GITHUB_RUN_ATTEMPT}`
  if (record.releaseId !== tag || record.inputs.publicSha !== context.sha ||
      record.build.repository !== `${context.repo.owner}/${context.repo.repo}`) throw new Error('Release identity mismatch')
  async function requireMissing(operation) {
    try { await operation() } catch (error) { if (error.status === 404) return; throw error }
    throw new Error('Release identity already exists; refusing overwrite')
  }
  await requireMissing(() => github.rest.repos.getReleaseByTag({ ...context.repo, tag }))
  await requireMissing(() => github.rest.git.getRef({ ...context.repo, ref: `tags/${tag}` }))
  // Repository administration settings require a broader token than this job.
  // Enforce the actual published lock below; consumers independently require it.
  const assets = ['release.json', 'record-provenance.jsonl', 'image-provenance.jsonl',
    'baked-content.json', 'dataset-snapshot.json', '66archive-web.tar']
  for (const name of assets) {
    if (!fs.statSync(path.join('.local/release', name)).isFile()) throw new Error(`Missing release evidence: ${name}`)
  }
  const { data: draft } = await github.rest.repos.createRelease({
    ...context.repo, tag_name: tag, target_commitish: context.sha,
    name: tag, draft: true, prerelease: true, make_latest: 'false',
    body: 'Verified public web candidate. No deployment is triggered. Consume only the digest and signed identity in release.json.',
  })
  for (const name of assets) {
    const data = fs.readFileSync(path.join('.local/release', name))
    await github.rest.repos.uploadReleaseAsset({
      ...context.repo, release_id: draft.id, name, data,
      headers: { 'content-type': 'application/octet-stream', 'content-length': data.length },
    })
  }
  const { data: release } = await github.rest.repos.updateRelease({
    ...context.repo, release_id: draft.id, draft: false, prerelease: true, make_latest: 'false',
  })
  if (release.immutable !== true) throw new Error('Release is not immutable; it must not be consumed')
  const { data: commit } = await github.rest.repos.getCommit({ ...context.repo, ref: tag })
  if (commit.sha !== context.sha) throw new Error('Published release tag has an unexpected source')
}
