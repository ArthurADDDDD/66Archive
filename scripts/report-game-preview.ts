import fs from 'node:fs'
import {getDataset} from '../src/lib/data'
import {visibleGameIds} from '../src/lib/games'
import {gameChapters,timelineTotals} from '../src/lib/game-chapters'
const ds=getDataset();const timelines=[...ds.timelines.values()]
if(!timelines.length)throw new Error('No reviewed timelines are available')
const rows=timelines.map(t=>{const e=ds.entries.find(e=>e.id===t.entry)!;const c=gameChapters(t);return {entry:t.entry,archiveDurationSec:(e.duration_min??0)*60,oldWholeSessionChargedSec:(e.duration_min??0)*60*visibleGameIds(e.games??[]).length,basisSec:t.parts.reduce((n,p)=>n+p.duration_sec,0),gameSec:c.filter(c=>c.gameId).reduce((n,c)=>n+c.durationSec,0),verifiedSec:c.reduce((n,c)=>n+c.verifiedSec,0),gameIntervals:c.filter(c=>c.gameId).map(c=>({game:c.gameId,sec:c.durationSec,verified:c.verified,jump:c.jump?.url}))}})
const report={scope:'Loaded reviewed timelines only; old whole-session metric is a diagnostic comparison, not a second statistical policy',totals:timelineTotals(timelines),oldWholeSessionChargedSec:rows.reduce((n,r)=>n+r.oldWholeSessionChargedSec,0),rows}
const result=JSON.stringify(report,null,2)+'\n';if(process.argv[2])fs.writeFileSync(process.argv[2],result);else process.stdout.write(result)
