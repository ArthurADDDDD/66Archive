import fs from 'node:fs'
import path from 'node:path'
import { GameTimelinesFile } from '../src/lib/schema'
import { getDataset } from '../src/lib/data'
import { checkGameTimelines } from '../src/lib/game-timeline-check'

// Explicit local artifact preparation; never writes data/ or changes review records.
const source=process.argv[2]
if(!source) throw new Error('Usage: node --import tsx scripts/prepare-game-preview.ts <reviewed-directory>')
const raw=fs.readdirSync(source).filter(n=>n.endsWith('.json')).sort().map(n=>JSON.parse(fs.readFileSync(path.join(source,n),'utf8')))
if(raw.some(t=>!t || typeof t!=='object' || 'draft' in t)) throw new Error('Only reviewed timeline files are allowed')
const timelines=GameTimelinesFile.parse(raw)
if(!timelines.length || new Set(timelines.map(t=>t.entry)).size!==timelines.length) throw new Error('Empty or duplicate preview')
const checked=checkGameTimelines(getDataset().entries,timelines)
if(checked.errors.length) throw new Error(checked.errors.join('\n'))
fs.mkdirSync('.local',{recursive:true})
const target='.local/game-timelines-preview.json'
fs.writeFileSync(target,JSON.stringify(timelines,null,2)+'\n')
console.log(`Prepared ${timelines.length} reviewed timelines in ${target}; no formal data written`)
