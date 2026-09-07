// Actions artifacts are evidence only; no registry tags are written here.
module.exports = async ({ github, context, core }) => {
  const fs = require('node:fs')
  const { execFileSync } = require('node:child_process')
  const current = JSON.parse(fs.readFileSync('.local/release/image-report.json', 'utf8'))
  const name = `66archive-web-${current.publicSha}`
  const artifacts = await github.paginate(github.rest.actions.listArtifactsForRepo, {
    ...context.repo, name, per_page: 100,
  })
  if (current.publicSha !== context.sha) throw new Error('Candidate SHA does not match the workflow')
  if (artifacts.length === 0) {
    // Reruns may delete the previous attempt's artifacts. Missing is not new.
    const attempt = Number(process.env.GITHUB_RUN_ATTEMPT || '1')
    if (!Number.isInteger(attempt) || attempt !== 1) {
      throw new Error('Previous attempt evidence is missing; refusing publication')
    }
    const runs = await github.paginate(github.rest.actions.listWorkflowRuns, {
      ...context.repo, workflow_id: 'release-web.yml', head_sha: current.publicSha, per_page: 100,
    })
    if (runs.some(run => run.head_sha === current.publicSha && run.id !== context.runId)) {
      throw new Error('Previous same-SHA run exists without verifiable evidence; refusing publication')
    }
  }
  for (const artifact of artifacts) {
    if (artifact.expired) throw new Error('Existing SHA evidence expired; cannot verify digest')
    if (artifact.workflow_run?.head_sha !== current.publicSha || artifact.workflow_run?.head_branch !== 'main') {
      throw new Error('Existing SHA evidence has an unexpected source')
    }
    const response = await github.rest.actions.downloadArtifact({
      ...context.repo, artifact_id: artifact.id, archive_format: 'zip',
    })
    const zip = `${process.env.RUNNER_TEMP}/shadow-${artifact.id}.zip`
    fs.writeFileSync(zip, Buffer.from(response.data))
    const previous = JSON.parse(execFileSync('unzip', ['-p', zip, 'image-report.json'], { encoding: 'utf8' }))
    fs.unlinkSync(zip)
    if (previous.publicSha !== current.publicSha || previous.digest !== current.digest ||
        previous.snapshotSha256 !== current.snapshotSha256) {
      throw new Error('Same public SHA has a different image/snapshot digest; refusing publication')
    }
  }
  core.setOutput('exists', artifacts.length > 0 ? 'true' : 'false')
}
