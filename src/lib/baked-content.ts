/**
 * 构建期烤入后台文案（只在服务端跑）
 * ==================================
 * 这个模块只允许被服务端组件引用。它在 `next build` 期间拉一次只读内容接口，
 * 把「此刻的后台文案」作为初始值交给 `LiveContentProvider`。
 *
 * 为什么需要它：站点是 `output: 'export'` 的静态导出，SSG 出来的 HTML 里原本是
 * `narrative.ts` / `site-copy.ts` 里写死的基线——那份值可能几个月没动过。于是
 * 每次加载都要先闪一下旧文案，等客户端拉到内容才纠正；而任何一次拉取失败，
 * 页面就停在那个很久以前的状态。**问题不在「有没有兜底」，在于兜底值选错了。**
 *
 * 烤入之后，兜底从「几个月前的硬编码值」变成「上次部署时的后台文案」：
 * - SSG 的 HTML 直接就是对的 → 没有闪烁，爬虫也能看到
 * - 接口挂掉时最多旧一个部署周期，而不是旧几个月
 *
 * **这里不改变编辑链路。** 客户端仍然照常拉实时内容并覆盖上去，
 * 所以在后台改文案依旧是立刻生效、不需要重新部署。烤入的只是兜底那一层。
 */

import { get as httpsGet } from 'node:https'
import { parseEditorial, parseNarrative, parseSiteCopy, type LiveContent, type LiveNarrative } from './live-content'
import { FALLBACK_SITE_ORIGIN } from './site-url'

const EMPTY: LiveContent = { narrative: null, copy: null, editorial: null }

const REQUEST_TIMEOUT_MS = 10_000

/**
 * 决定这次构建去哪拉内容：
 * - `CONTENT_BAKE_ORIGIN=off` → 完全关闭（离线构建用）
 * - `CONTENT_BAKE_ORIGIN=<url>` → 用指定地址（本地验证烤入效果用）
 * - 未设置 + 生产构建 → `SITE_ORIGIN`，没有才落到默认公开地址
 * - 未设置 + dev → 不烤。dev 下每次请求都打线上既慢又没必要，
 *   而客户端覆盖在 dev 里照常工作，行为不受影响。
 */
function resolveOrigin(): string | null {
  const raw = process.env.CONTENT_BAKE_ORIGIN?.trim()
  if (raw === 'off') return null
  if (raw) return raw.replace(/\/$/, '')
  if (process.env.NODE_ENV !== 'production') return null
  return (process.env.SITE_ORIGIN?.trim() || FALLBACK_SITE_ORIGIN).replace(/\/$/, '')
}

/**
 * 故意用 `node:https` 而不是 `fetch`。
 *
 * Next 会给全局 `fetch` 打桩：带 `cache: 'no-store'` 的请求会把所在路由标记成动态，
 * 而 `output: 'export'` 下所有路由都是 `dynamic = 'error'`，于是整个构建直接失败
 * （实测会在预渲染 `/e/[id]` 时崩掉）。改用 `force-cache` 又会把响应写进
 * `.next/cache` 的 fetch 缓存里，可能跨构建复用到旧内容——烤入的意义就没了。
 *
 * 这是一次纯粹的构建期取数，不该受渲染层缓存语义摆布，所以直接走 Node 的 HTTP 客户端。
 */
function getJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = httpsGet(url, { headers: { accept: 'application/json' } }, (response) => {
      const status = response.statusCode ?? 0
      if (status < 200 || status >= 300) {
        response.resume()
        reject(new Error(`HTTP ${status}`))
        return
      }
      response.setEncoding('utf8')
      let body = ''
      response.on('error', reject)
      response.on('data', (chunk: string) => {
        body += chunk
      })
      response.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch {
          reject(new Error('响应不是合法 JSON'))
        }
      })
    })
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error('超时')))
    request.on('error', reject)
  })
}

async function fetchOne(origin: string, path: string): Promise<unknown | null> {
  try {
    return await getJson(`${origin}${path}`)
  } catch (error) {
    console.warn(`[baked-content] ${path} 拉取失败：${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

async function loadBakedContent(): Promise<LiveContent> {
  const origin = resolveOrigin()
  if (!origin) return EMPTY

  const [narrative, copy, editorial] = await Promise.all([
    fetchOne(origin, '/api/content/narrative'),
    fetchOne(origin, '/api/content/site-copy'),
    fetchOne(origin, '/api/content/editorial'),
  ])

  const baked: LiveContent = {
    narrative: parseNarrative(narrative),
    copy: parseSiteCopy(copy),
    editorial: parseEditorial(editorial),
  }

  const missing = (Object.keys(baked) as (keyof LiveContent)[]).filter((key) => baked[key] === null)
  if (missing.length > 0) {
    const detail = `${origin} 的 ${missing.join(' / ')} 没能烤入`
    // 生产发布不能拿几个月前的源码基线覆盖已经发布的当前内容。接口短暂异常时
    // 中止这次静态构建，线上继续保留上一份成功烤入的发布版本；显式 off 仍可供
    // 完全离线的本地构建使用。
    if (process.env.NODE_ENV === 'production' || process.env.CONTENT_BAKE_REQUIRED === '1') {
      throw new Error(`[baked-content] ${detail}；为保留上一份成功发布的内容，中止构建。`)
    }
    console.warn(`[baked-content] ${detail}，这部分退回公仓基线（站点仍可用，仅失去烤入带来的改善）。`)
  } else {
    console.log(`[baked-content] 已从 ${origin} 烤入 narrative / site-copy / editorial。`)
  }

  return baked
}

/** 整次构建只取一份的单例。 */
let inflight: Promise<LiveContent> | null = null

/**
 * 取构建期烤入的后台内容。
 *
 * **必须是进程级单例，不能只靠 `React.cache()`。** `cache()` 只在单次渲染内去重，
 * 而静态导出里每个页面都是独立渲染——站点有两千多个条目页，按渲染去重等于
 * 「页数 × 3」次请求打向线上。实测会被限流挡回 429、整份烤入失败，
 * 相当于用自己的构建把自己的站点刷了一遍。模块级 promise 在整个构建进程里
 * 只解析一次，全程就 3 次请求。
 */
export function fetchBakedContent(): Promise<LiveContent> {
  inflight ??= loadBakedContent()
  return inflight
}

/**
 * 根 layout 烤的最小一份：站点标题与导航标签，别的都不带。
 *
 * 此前这里烤的是**整份** site-copy 加整份 editorial。但站内 3,488 个导出页里有 3,483 个
 * 只用得到 `site`（`LiveDocumentMeta` 改 title）和 `nav`（`SiteNav` / `MobileQuickNav` 的标签）——
 * `hero` / `homeSections` / `rooms` / `pages` / `maintainers` / `editorial` 各自只有一两个页面读。
 * 实测整份带着走在条目页上是 3,860 B br（该页的 32%）、`/archive/` 上 3,919 B（44%）、
 * 游戏详情页 3,846 B。
 *
 * 需要更多的页面（首页、/stats/、/games/、/series/、/gallery/、/contact/）用
 * `LiveCopySeed` 自己补齐，做法与 narrative 那一层完全一致。
 *
 * 空数组 / 空字符串在 `mergeSiteCopy` 里就是「没有覆盖」，所以被裁掉的字段自然退回
 * `site-copy.ts` 的公开仓基线——而那些字段在这些页面上根本没有渲染位置。
 */
export async function fetchBakedNavShell(): Promise<LiveContent> {
  const { copy } = await fetchBakedContent()
  if (!copy) return { narrative: null, copy: null, editorial: null }
  return {
    narrative: null,
    editorial: null,
    copy: {
      ...copy,
      hero: { status: '', eyebrow: '', title: '', body: [], primaryAction: '', secondaryAction: '' },
      homeSections: [],
      rooms: [],
      pages: [],
      maintainers: [],
    },
  }
}

/**
 * 全站通用的那部分：站点文案与板块编排，**不含 narrative**。
 *
 * 根 layout 只烤这一份。narrative 约 28KB，是三份里最大的一份，而站内两千多个
 * 条目页根本不读它——放进根 layout 等于让每个页面的 RSC 载荷都背上这 28KB。
 * 实测：整份烤进根 layout 会让 `out/` 从 231M 涨到 610M（+164%）、条目页 HTML
 * 从 40KB 涨到 78KB（几乎翻倍）。按需分层之后条目页只多约 6KB。
 *
 * 需要 narrative 的页面（首页与编年史）自己用 `LiveNarrativeSeed` 补上。
 */
export async function fetchBakedShell(): Promise<LiveContent> {
  const { copy, editorial } = await fetchBakedContent()
  return { narrative: null, copy, editorial }
}

/**
 * narrative 的第二层分层：首页只要 `homeActs` + `highlights`，编年史只要 `storyActs`。
 *
 * 这份烤入已经被从根 layout 里摘出去过一次（见上面 `fetchBakedShell` 的说明），
 * 但摘出去之后，首页和编年史各自仍然背着**整份** narrative——包括对方那一半。
 * 实测：`storyActs` 占首页 flight 的 18.4%（21,091 / 114,871 字符），首页一个字都不读；
 * 编年史那边 `homeActs` + `highlights` 是 7,810 字符，同样不读。按幕切开之后
 * 首页 HTML 少 6,174 B、编年史少 1,999 B（brotli）。
 *
 * `deletedIds` 两边都要留——它是「后台删掉了哪些节点」的名单，三个 scope 共用，
 * 丢掉会让已删除的节点重新冒出来。
 *
 * 这只影响**烤入的初始值**。实时内容到达后 `LiveContentProvider` 会整份换成
 * `/api/content/narrative` 的响应，两个页面拿到的仍是完整 narrative。
 */
export async function fetchBakedHomeNarrative(): Promise<LiveNarrative | null> {
  const { narrative } = await fetchBakedContent()
  return narrative && { ...narrative, storyActs: [] }
}

/** 编年史那一半：只留 `storyActs`（与共用的 `deletedIds`）。 */
export async function fetchBakedStoryNarrative(): Promise<LiveNarrative | null> {
  const { narrative } = await fetchBakedContent()
  return narrative && { ...narrative, homeActs: [], highlights: [] }
}
