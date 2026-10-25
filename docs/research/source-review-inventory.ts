/** Read-only evidence inventory. Run from repository root with node --import tsx. */
import fs from 'node:fs'
import path from 'node:path'
import { getDataset, buildSourceGroups } from '../../src/lib/data'
import { visibleGameIds } from '../../src/lib/games'
import { REVIEWED_GAPS } from '../../scripts/game-timeline-dispositions'

const out = process.argv[2]
if (!out) throw new Error('Pass an output directory; formal data is never modified.')
if (process.env.ARCHIVE_TIMELINE_PREVIEW) throw new Error('Unset ARCHIVE_TIMELINE_PREVIEW to audit formal data only.')
const resolved = path.resolve(out)
const data = path.resolve('data')
if (resolved === data || resolved.startsWith(data + path.sep)) throw new Error('Output must be outside data/')
const ds = getDataset()
const groups = buildSourceGroups(ds.entries)
const csv = (rows: unknown[][]) => rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n') + '\n'
const sourceRows: unknown[][] = [['entry', 'date', 'title', 'entry_confidence', 'url', 'kind', 'status', 'account', 'account_role', 'account_identity_confidence', 'source_note']]
const queueRows: unknown[][] = [['entry', 'date', 'title', 'entry_confidence', 'flags', 'games', 'timeline_basis', 'basis_coverage', 'games_absent_from_basis', 'known_gap_dispositions', 'missing_footage', 'sources']]
const counts: Record<string, number> = {}
for (const entry of ds.entries.toSorted((a, b) => a.id.localeCompare(b.id))) {
  const group = groups.get(entry.id) ?? [entry]
  const timeline = ds.timelines.get(group[0].id)
  const games = visibleGameIds([...new Set(group.flatMap(e => e.games))])
  const absent = timeline ? games.filter(game => !timeline.spans.some(span => span.game === game)) : []
  const known = REVIEWED_GAPS.filter(gap => group.some(e => e.id === gap.entry))
  const flags: string[] = []
  if (entry.confidence !== 'high') flags.push('entry-confidence-' + entry.confidence)
  if (entry.sources.some(s => !s.account)) flags.push('source-account-unassigned')
  if (entry.sources.some(s => s.account && ds.accounts.get(s.account)?.role !== 'official')) flags.push('has-nonofficial-source')
  if (entry.sources.some(s => s.status === 'unchecked')) flags.push('has-unchecked-source')
  if (entry.sources.length && entry.sources.every(s => s.kind === 'clip')) flags.push('clip-only')
  if (entry.no_public_replay) flags.push('no-public-replay')
  if (entry.missing_footage) flags.push('missing-footage-recorded')
  if (timeline && timeline.coverage !== 'complete') flags.push('basis-' + timeline.coverage)
  if (absent.length) flags.push('games-absent-from-basis')
  if (known.some(g => g.status === 'evidence_insufficient')) flags.push('known-game-evidence-insufficient')
  for (const flag of flags) counts[flag] = (counts[flag] ?? 0) + 1
  queueRows.push([entry.id, entry.date, entry.title, entry.confidence, flags.join('|'), entry.games.join('|'), timeline?.basis, timeline?.coverage, absent.join('|'), known.map(g => `${g.games.join('+')}:${g.status}`).join('|'), entry.missing_footage, entry.sources.map(s => s.url).join('|')])
  for (const source of entry.sources) {
    const account = source.account ? ds.accounts.get(source.account) : undefined
    sourceRows.push([entry.id, entry.date, entry.title, entry.confidence, source.url, source.kind, source.status, source.account, account?.role ?? 'unassigned', account?.confidence, source.note])
  }
}
fs.mkdirSync(resolved, { recursive: true })
fs.writeFileSync(path.join(resolved, 'entries.csv'), csv(queueRows))
fs.writeFileSync(path.join(resolved, 'sources.csv'), csv(sourceRows))
const summary = {
  entries: queueRows.length - 1,
  sourceReferences: sourceRows.length - 1,
  uniqueSourceUrls: new Set(sourceRows.slice(1).map(row => row[4])).size,
  flags: counts,
  caveats: [
    'Flags overlap and count raw entries, not merged live sessions.',
    'Unassigned accounts are unknown attribution, not proof of a nonofficial uploader.',
    'Account confidence describes identity; entry confidence does not measure every source.',
    'Absence from one timeline basis does not prove absence from the live session or complementary sources.',
    'Metadata inventory only; neither playback validation nor full-session viewing.',
  ],
}
fs.writeFileSync(path.join(resolved, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
