import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

type PublicDatasetModule = {
  getDataset: () => {
    entries: unknown[]
    games: Map<string, unknown>
    series: Map<string, unknown>
    accounts: Map<string, unknown>

    tags?: Map<string, unknown>
    isDemo: boolean
  }
}

type PublicGalleryModule = {
  getGalleryCollection: () => { items: unknown[]; gaps: unknown[] }
}

type PublicGalleryPhotosModule = {
  getGalleryPhotos: () => unknown[]
}

type PublicBeatTarget =
  | { kind: 'entry'; id: string; href?: string }
  | { kind: 'game'; id: string }
  | { kind: 'series'; id: string }
  | { kind: 'href'; href: string }
  | { kind: 'none' }

type PublicBeat = {
  id: string
  act?: string
  title: string
  kicker?: string
  body?: string
  date: string
  size: 'hero' | 'type' | 'small' | 'montage'
  important?: boolean
  chips?: string[]
  tail?: string
  target?: PublicBeatTarget
  gameWorld?: { text: string; rel?: string; date?: string }
}
type PublicAct = {
  id: string
  title: string
  kicker: string
  body: string[]
  beats: PublicBeat[]
  label: string
  years: string
  color: string
  closer?: { line: string; tail?: string }
}
type PublicHighlight = {
  id: string
  act: string
  title: string
  kicker?: string
  body?: string
  date: string
  emphasis?: string
  entryId?: string
  href?: string
  link?: false
  cover?: string | null
  category?: 'dazhou-mc' | 'xinling-pishuang' | 'peiqi' | 'daily-meme' | 'game-meme' | null
}
type PublicNarrativeModule = {
  HOMEPAGE_ACTS: PublicAct[]
  STORY_ACTS: PublicAct[]
  HIGHLIGHTS: PublicHighlight[]
}
type PublicExtraHighlightModule = {
  EXTRA_HIGHLIGHTS: PublicHighlight[]
}
type PublicSiteCopyModule = { SITE_COPY: Record<string, unknown> }

function beatBaseline(beat: PublicBeat, actId: string) {
  const target = beat.target
  const entryId = target?.kind === 'entry' ? target.id : ''
  const link =
    target?.kind === 'entry' ? target.href ?? `/e/${target.id}/`
    : target?.kind === 'game' ? `/games/${target.id}/`
    : target?.kind === 'series' ? `/series/${target.id}/`
    : target?.kind === 'href' ? target.href
    : ''
  return { act: beat.act ?? actId, entryId, link, cover: '' }
}

function highlightBaseline(highlight: PublicHighlight) {
  const entryId = highlight.entryId ?? ''
  return {
    act: highlight.act,
    entryId,
    link: highlight.link === false ? '' : highlight.href ?? (entryId ? `/e/${entryId}/` : '/chronicle/'),
    cover: highlight.cover ?? '',
  }
}

function narrativeBeat(beat: PublicBeat, actId: string) {
  return {
    id: beat.id,
    kicker: beat.kicker ?? '',
    title: beat.title,
    body: beat.body ?? '',
    visible: true,
    date: beat.date ?? '',
    important: beat.important ?? false,
    size: beat.size ?? 'small',
    chips: beat.chips ?? [],
    footnote: {
      text: beat.gameWorld?.text ?? '',
      rel: beat.gameWorld?.rel ?? '',
      date: beat.gameWorld?.date ?? '',
    },
    tail: beat.tail ?? '',
    baseline: beatBaseline(beat, actId),
  }
}

function narrativeAct(act: PublicAct) {
  return {
    id: act.id,
    kicker: act.kicker ?? '',
    title: act.title,
    body: act.body ?? [],
    visible: true,
    beats: act.beats.map((beat) => narrativeBeat(beat, act.id)),
    label: act.label || act.title,
    years: act.years ?? '',
    color: act.color ?? '#5A5F73',
    closer: { line: act.closer?.line ?? '', tail: act.closer?.tail ?? '' },
  }
}

function assertUniqueIds(ids: string[], label: string): void {
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index)
  if (duplicate) throw new Error(`Public narrative ${label} contains a duplicate stable id: ${duplicate}`)
}

const publicRepoPath = process.env.PUBLIC_REPO_PATH || process.cwd()

const publicRoot = path.resolve(publicRepoPath)
const outputRoot = path.resolve(process.env.SNAPSHOT_OUTPUT_ROOT || process.cwd())
if (!fs.existsSync(path.join(publicRoot, 'src', 'lib', 'data.ts'))) {
  throw new Error(`PUBLIC_REPO_PATH does not look like a public checkout: ${publicRoot}`)
}

const originalCwd = process.cwd()

async function main() {
  let snapshot: Record<string, unknown>
  try {
    process.chdir(publicRoot)
    const dataModule = (await import(pathToFileURL(path.join(publicRoot, 'src/lib/data.ts')).href)) as PublicDatasetModule
    const galleryModule = (await import(pathToFileURL(path.join(publicRoot, 'src/lib/gallery.ts')).href)) as PublicGalleryModule
    const galleryPhotosModulePath = path.join(publicRoot, 'src/lib/gallery-photos-manifest.ts')
    const galleryPhotosModule = fs.existsSync(galleryPhotosModulePath)
      ? ((await import(pathToFileURL(galleryPhotosModulePath).href)) as PublicGalleryPhotosModule)
      : null
    const narrativeModule = (await import(pathToFileURL(path.join(publicRoot, 'src/lib/narrative.ts')).href)) as PublicNarrativeModule
    const extraHighlightModule = (await import(pathToFileURL(path.join(publicRoot, 'src/lib/highlight-extras.ts')).href)) as PublicExtraHighlightModule
    const siteCopyModule = (await import(pathToFileURL(path.join(publicRoot, 'src/lib/site-copy.ts')).href)) as PublicSiteCopyModule
    const dataset = dataModule.getDataset()
    const gallery = galleryModule.getGalleryCollection()
    const galleryPhotos = galleryPhotosModule?.getGalleryPhotos() ?? []
    const publicHighlights = [...narrativeModule.HIGHLIGHTS, ...extraHighlightModule.EXTRA_HIGHLIGHTS]

    const narrative = {
      version: 1 as const,
      homeActs: narrativeModule.HOMEPAGE_ACTS.map(narrativeAct),
      highlights: publicHighlights.map((highlight) => ({
        id: highlight.id,
        kicker: highlight.kicker ?? '',
        title: highlight.title,
        body: highlight.body ?? '',
        visible: true,
        date: highlight.date ?? '',
        emphasis: highlight.emphasis ?? '',
        expanded: false,
        category: highlight.category ?? null,
        baseline: highlightBaseline(highlight),
      })),
      storyActs: narrativeModule.STORY_ACTS.map(narrativeAct),
      deletedIds: [],
    }
    assertUniqueIds(narrative.homeActs.map((act) => act.id), 'HOMEPAGE_ACTS')
    assertUniqueIds(narrative.storyActs.map((act) => act.id), 'STORY_ACTS')
    assertUniqueIds(narrative.highlights.map((highlight) => highlight.id), 'HIGHLIGHTS + EXTRA_HIGHLIGHTS')
    for (const act of [...narrative.homeActs, ...narrative.storyActs]) {
      assertUniqueIds(act.beats.map((beat) => beat.id), `act ${act.id} beats`)
    }
    const sourceCommit = execFileSync('git', ['-C', publicRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    const entryFiles = fs
      .readdirSync(path.join(publicRoot, 'data', 'entries'))
      .filter((name) => /\.ya?ml$/i.test(name)).length

    snapshot = {
      version: 1,
      source: {
        commit: sourceCommit,
        generatedAt: new Date(Number(execFileSync('git', ['-C', publicRoot, 'show', '-s', '--format=%ct', 'HEAD'], { encoding: 'utf8' }).trim()) * 1000).toISOString(),
      },
      dataset: {
        entries: dataset.entries,
        games: [...dataset.games.values()],
        series: [...dataset.series.values()],
        accounts: [...dataset.accounts.values()],
        tags: [...(dataset.tags?.values() ?? [])],
        entryFiles,
        isDemo: dataset.isDemo,
      },
      gallery,
      galleryPhotos,
      narrative,
      siteCopy: siteCopyModule.SITE_COPY,
    }
  } finally {
    process.chdir(originalCwd)
  }

  const snapshotDir = path.join(outputRoot, '.local')
  fs.mkdirSync(snapshotDir, { recursive: true })
  const outputPath = path.join(snapshotDir, 'dataset-snapshot.json')
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`
  fs.writeFileSync(outputPath, serialized, 'utf8')

  const snapshotSha256 = createHash('sha256').update(serialized).digest('hex')
  const sidecarPath = `${outputPath}.sha256`
  fs.writeFileSync(sidecarPath, `${snapshotSha256}\n`, 'utf8')
  console.log('Public dataset snapshot written')
  console.log(`Snapshot sha256: ${snapshotSha256}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
