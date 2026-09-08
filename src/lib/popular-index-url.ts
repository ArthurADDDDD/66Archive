import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/** 索引的固定路径。nginx 那边是 `location = /data/popular-index.json` 精确匹配，不能改。 */
const INDEX_PATH = '/data/popular-index.json'

/**
 * 标题索引的**构建期身份**，理由与 `lib/archive-data-url.ts` 完全相同——
 * 这两份 JSON 在 nginx 里是同一组头（`s-maxage=600, stale-while-revalidate=86400`），
 * 而 HTML 只有 `s-maxage=60, swr=300`，于是发布之后最长 24 小时里边缘都可能
 * 还在发上一版。2026-09-09 实测两份**同时**落后了 4.6 小时。
 *
 * 这里的后果比录播室轻：`PopularContent` 匹配不到标题时退回显示裸 ID
 * （`label?.t || item.id`），所以只有这次新加的条目会短暂显示成 ID。
 * 但成因和修法一模一样，没有理由留着。
 *
 * 索引是构建期派生文件（`npm run index:popular`，见 `scripts/popular-index-build.ts`，
 * 纯由 `data/**` 决定、不含时间戳），所以哈希是确定的：同一份源码构建出同一个版本号。
 */
let cached: string | null = null

export function popularIndexUrl(): string {
  if (cached) return cached
  try {
    const bytes = readFileSync(path.join(process.cwd(), 'public', 'data', 'popular-index.json'))
    cached = `${INDEX_PATH}?v=${createHash('sha256').update(bytes).digest('hex').slice(0, 12)}`
  } catch {
    // 只有绕过 `npm run build` 直接跑 `next build` 才会走到这儿。排行退回显示裸 ID
    // 是既有的降级行为，不该因为少一个派生文件就让整个数据页构建失败。
    cached = INDEX_PATH
  }
  return cached
}
