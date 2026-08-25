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
import { parseEditorial, parseNarrative, parseSiteCopy, type LiveContent } from './live-content'

/**
 * 站点公开地址。已经写在 README 里，属于公开信息，不是需要注入的生产配置——
 * 写成默认值是为了让发布流水线不需要任何改动就能享受烤入。
 */
const DEFAULT_BAKE_ORIGIN = 'https://i6i6.space'

const EMPTY: LiveContent = { narrative: null, copy: null, editorial: null }

const REQUEST_TIMEOUT_MS = 10_000

/**
 * 决定这次构建去哪拉内容：
 * - `CONTENT_BAKE_ORIGIN=off` → 完全关闭（离线构建用）
 * - `CONTENT_BAKE_ORIGIN=<url>` → 用指定地址（本地验证烤入效果用）
 * - 未设置 + 生产构建 → 用默认公开地址
 * - 未设置 + dev → 不烤。dev 下每次请求都打线上既慢又没必要，
 *   而客户端覆盖在 dev 里照常工作，行为不受影响。
 */
function resolveOrigin(): string | null {
  const raw = process.env.CONTENT_BAKE_ORIGIN?.trim()
  if (raw === 'off') return null
  if (raw) return raw.replace(/\/$/, '')
  if (process.env.NODE_ENV !== 'production') return null
  return DEFAULT_BAKE_ORIGIN
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
