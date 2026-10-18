import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chaptersForGame, gameChapters, timelineTotals } from '../src/lib/game-chapters'
import { readLocalTimelinePreview } from '../src/lib/local-timeline-preview'
import { getDataset, getGameTimelines, toTimelineEntries } from '../src/lib/data'
import { decodeArchiveEntry, encodeArchiveEntry } from '../src/lib/archive-payload'
import { checkGameTimelines } from '../src/lib/game-timeline-check'
import type { GameTimeline } from '../src/lib/schema'

const t:GameTimeline={entry:'sample',basis:'https://www.bilibili.com/video/BV1aaaaaaaaa',coverage:'complete',reviewed:'2026-10-17',
  parts:[{page:1,id:1,duration_sec:900},{page:2,id:2,duration_sec:900}],
  spans:[{page:1,at:'00:00:00',game:'a',precision:'approx',evidence:'thumbnails',scanned:true},
    {page:1,at:'00:05:00',game:'b',precision:'approx',evidence:'human_watch',scanned:true},
    {page:2,at:'00:00:08',game:'a',precision:'approx',evidence:'human_watch',scanned:true}]}
const repeated=chaptersForGame(t,'a')
assert.equal(repeated.length,2)
assert.equal(repeated[0].durationSec,300)
assert.equal(repeated[1].jump?.url,'https://www.bilibili.com/video/BV1aaaaaaaaa/?p=2&t=8')
assert.equal(repeated[1].endAt,'00:15:00')
assert.equal(timelineTotals([t]).gameSec,1800)
assert.equal(timelineTotals([t]).verifiedSec,1800)
const notScanned={...t,spans:t.spans.map(s=>({...s,scanned:false}))}
assert.equal(timelineTotals([notScanned]).verifiedSec,0)
const child={...t,spans:t.spans.map(s=>({...s,game:'maplestory-classic'}))}
assert.equal(chaptersForGame(child,'maplestory').length,1)
assert.equal(chaptersForGame(child,'maplestory-classic').length,1)
assert.equal(timelineTotals([child]).verifiedSec,1800)
const rest:GameTimeline={...t,spans:[
  {...t.spans[0],game:'a'},
  {page:1,at:'00:05:00',kind:'break',precision:'approx',evidence:'human_watch'},
  {...t.spans[2],game:'a'},
]}
assert.equal(gameChapters(rest).length,1)
assert.equal(chaptersForGame(rest,'a').length,1)
assert.equal(gameChapters(rest)[0].endPage,2)
assert.equal(gameChapters(rest)[0].endAt,'00:15:00')
assert.equal(gameChapters(rest)[0].jump?.page,1)
assert.equal(gameChapters(rest)[0].verified,false)
assert.equal(timelineTotals([rest]).gameSec,1800)
assert.equal(timelineTotals([rest]).breakSec,0)
assert.equal(timelineTotals([rest]).verifiedSec,1192)
const a=gameChapters({...t,basis:'https://www.acfun.cn/v/ac123'})[2]
assert.equal(a.jump?.url,'https://www.acfun.cn/v/ac123_2')
assert.equal(a.jump?.seeks,false)
assert.ok(!a.jump?.url.includes('t='))
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timeline-preview-test-'));const file=path.join(dir,'preview.json')
try {
  fs.writeFileSync(file,JSON.stringify([t]))
  assert.throws(()=>readLocalTimelinePreview(file,'production'),/local development/)
  assert.equal(readLocalTimelinePreview(file,'development').length,1)
  fs.writeFileSync(file,JSON.stringify([{...t,draft:{status:'unreviewed'}}]))
  assert.throws(()=>readLocalTimelinePreview(file,'development'),/never machine drafts/)
  fs.writeFileSync(file,JSON.stringify([t,t]))
  assert.throws(()=>readLocalTimelinePreview(file,'development'),/Duplicate/)
} finally { fs.rmSync(dir,{recursive:true}) }
{
  const ds=getDataset();const reviewed=getGameTimelines()
  assert.ok(reviewed.length>0)
  assert.deepEqual(checkGameTimelines(ds.entries,reviewed).errors,[])
  const may6=reviewed.find(t=>t.entry==='2021-05-06-live-01')
  if(may6) {
    assert.equal(may6.spans.length,3,'原人工跨度保持不变')
    assert.equal(chaptersForGame(may6,'wonder-boy-asha').length,1)
    assert.equal(timelineTotals([may6]).breakSec,0)
  }
  const loop=reviewed.find(t=>t.entry==='2021-07-30-live-02')
  if(loop) assert.equal(chaptersForGame(loop,'naraka-bladepoint').length,2)

  const entries=toTimelineEntries(ds)
  const publicChapters=entries.filter(entry=>entry.chapters)
  assert.equal(publicChapters.length,ds.timelines.size)
  for(const entry of publicChapters) {
    assert.ok(entry.chapterBasis?.includes('bilibili.com/video/') || entry.chapterBasis?.includes('acfun.cn/v/'))
    assert.equal(entry.chapters?.every(chapter=>Boolean(chapter.jumpUrl)),true)
    for(const chapter of entry.chapters ?? []) {
      assert.ok(!('id' in chapter),'public chapter projection must not expose platform CID/video ids')
      assert.ok(!('note' in chapter),'public chapter projection must not expose review notes')
      assert.ok(!('spans' in chapter),'public chapter projection must not expose raw timeline spans')
      assert.ok(!('parts' in chapter),'public chapter projection must not expose raw timeline parts')
    }
  }
  const loopEntry=publicChapters.find(entry=>entry.id==='2021-07-30-live-02')
  if(loopEntry) assert.equal(loopEntry.chapters?.filter(chapter=>chapter.gameId==='naraka-bladepoint').length,2)
  const projected=publicChapters[0]
  assert.deepEqual(decodeArchiveEntry(encodeArchiveEntry(projected)),projected)
  const legacy=encodeArchiveEntry(projected) as Record<string,unknown>
  delete legacy.chapters; delete legacy.chapterBasis; delete legacy.chapterReviewed; delete legacy.chapterCoverage
  const oldDecoded=decodeArchiveEntry(legacy as never)
  assert.ok(!('chapters' in oldDecoded),'old payloads without chapter fields remain valid')
  const noTimeline=entries.find(entry=>!entry.chapters)!
  assert.ok(!('chapters' in noTimeline),'entries without timelines omit optional chapter fields')
  assert.ok(!('chapterBasis' in noTimeline))
  console.log(`${publicChapters.length} reviewed public chapter projections: `,timelineTotals(reviewed))
}
console.log('OK chapters, repeated game jumps, AcFun downgrade, preview publication guard')
