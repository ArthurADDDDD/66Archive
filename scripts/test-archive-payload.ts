/**
 * `/archive-data.json` 的线上编码必须是**构造上无损**的。
 *
 * 那份编码省掉的都是「能从别处精确推回来」的字段（色带的 to / name、
 * 来源的 entryTitle、五个可从 sources 重算的计数）。推导规则一旦有例外——
 * 比如某场的 segment 越过了标称时长，相邻色带并不首尾相接——就会静默改写数据：
 * 页面照常渲染，只是数字悄悄错了。所以这里拿真实数据集逐条深度比对。
 */
import { getDataset, toTimelineEntries } from '../src/lib/data'
import { decodeArchiveEntry, encodeArchiveEntry } from '../src/lib/archive-payload'

function diff(path: string, a: unknown, b: unknown, out: string[]): void {
  if (out.length > 12) return
  if (a === b) return
  if (typeof a !== typeof b || a === null || b === null) {
    out.push(`${path}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`)
    return
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) out.push(`${path}.length: ${a.length} → ${b.length}`)
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) diff(`${path}[${i}]`, a[i], b[i], out)
    return
  }
  if (typeof a === 'object') {
    const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)])
    for (const key of keys) {
      diff(`${path}.${key}`, (a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], out)
    }
    return
  }
  out.push(`${path}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`)
}

const entries = toTimelineEntries(getDataset())
const failures: string[] = []
let bandsChecked = 0
let derivedTo = 0
let explicitTo = 0

for (const entry of entries) {
  const round = decodeArchiveEntry(encodeArchiveEntry(entry))
  const out: string[] = []
  diff(entry.id, entry, round, out)
  if (out.length > 0) failures.push(...out)

  const encoded = encodeArchiveEntry(entry)
  bandsChecked += encoded.bands.length
  for (const band of encoded.bands) {
    if (band.length === 4) explicitTo += 1
    else derivedTo += 1
  }
}

/**
 * 旧格式必须原样通过。
 *
 * 这份载荷由边缘按 stale-while-revalidate=86400 独立缓存，不与 JS 同步切换——
 * 发布后最长 24 小时内新解码器都可能拿到上一版格式。2026-09-08 就这么让录播室
 * 整页显示「档案数据暂时没有加载成功」过一次。
 */
const legacyFailures: string[] = []
for (const entry of entries.slice(0, 400)) {
  const passthrough = decodeArchiveEntry(entry as never)
  const out: string[] = []
  diff(`legacy:${entry.id}`, entry, passthrough, out)
  if (out.length > 0) legacyFailures.push(...out)
}
if (legacyFailures.length > 0) {
  console.error('\n✗ 旧格式条目没有原样通过：')
  for (const line of legacyFailures.slice(0, 8)) console.error('  ' + line)
  process.exit(1)
}
console.log(`✓ 旧格式（未编码）条目 400 条原样通过解码器，不会因为边缘缓存错位而炸`)

const encodedBytes = Buffer.byteLength(JSON.stringify(entries.map(encodeArchiveEntry)))
const plainBytes = Buffer.byteLength(JSON.stringify(entries))

console.log(`条目 ${entries.length} 条 · 色带 ${bandsChecked} 段（${derivedTo} 段的 to 由下一段推出，${explicitTo} 段必须显式写出）`)
console.log(`原始 JSON ${plainBytes.toLocaleString()} B → 编码后 ${encodedBytes.toLocaleString()} B（−${(100 * (1 - encodedBytes / plainBytes)).toFixed(1)}%）`)

if (failures.length > 0) {
  console.error(`\n✗ 往返不一致（前 ${Math.min(failures.length, 12)} 条）：`)
  for (const line of failures.slice(0, 12)) console.error('  ' + line)
  process.exit(1)
}
console.log('✓ 全部条目 encode → decode 后与原值深度相等')
