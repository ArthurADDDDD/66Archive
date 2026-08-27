/**
 * 资料纠错接口的前台客户端（只写一条，不读）。
 *
 * 站点是静态导出的，没有服务端，所以表单直接 POST 到由网关反代的公开接口。
 * 与投票同一套约定：同源、`credentials` 不需要（这个接口不认 cookie）、
 * 失败时抛出**服务端给的中文文案**，而不是自己编一句。
 *
 * 配置（人机验证的 site key、长度上限）也从服务端取，不在构建期固化——
 * 固化的话密钥轮换要重新部署，CI 漏配变量则会变成「表单看着正常、提交永远失败」。
 */

const API_BASE = (process.env.NEXT_PUBLIC_VOTE_API_BASE ?? '').replace(/\/$/, '')

/** 与服务端 `/api/correction/config` 的响应对应。 */
export type CorrectionConfig = {
  /** site key 与服务端 secret 都齐备时才为 true。false 时前台应显示「暂未开放」。 */
  enabled: boolean
  turnstileSiteKey: string | null
  limits: { nameMax: number; bodyMax: number }
}

/** 配置拿不到时的保底值。刻意 `enabled: false`——宁可显示「暂未开放」，也不给一个必定失败的按钮。 */
export const CORRECTION_CONFIG_FALLBACK: CorrectionConfig = {
  enabled: false,
  turnstileSiteKey: null,
  limits: { nameMax: 60, bodyMax: 2000 },
}

const REQUEST_TIMEOUT_MS = 20_000

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'content-type': 'application/json', ...init?.headers },
    })
    const body = (await response.json().catch(() => null)) as { message?: string } | null
    if (!response.ok) {
      // 服务端的 message 是我们自己写死的中文文案，可以直接展示；
      // 没有就退回一句通用的，绝不把状态码或内部细节抛给用户。
      throw new Error(body?.message ?? '提交失败，请稍后再试')
    }
    return body
  } finally {
    clearTimeout(timer)
  }
}

/**
 * **有意不在这里吞掉网络错误。** 早先的版本 catch 到任何失败都静默退回
 * `CORRECTION_CONFIG_FALLBACK`（`enabled: false`），调用方因此分不清「服务端明确
 * 说功能没开」和「这次请求恰好超时/断线，压根没问到答案」——两种在界面上长得一样，
 * 都是一句「提交功能暂未开放」。
 *
 * 表单原本在页面一加载就挂载，config 有大半个页面停留时间去重试/追上，
 * 瞬时失败很少被用户看见。改成点开才挂载（联系页，避免一进页面就白触发
 * Cloudflare 人机验证）之后，这次请求就是唯一机会，没有缓冲时间——瞬时失败第一次
 * 就会直接展示成"暂未开放"，而用户一刷新（= 再请求一次）就好了，这正是这类问题的
 * 典型指纹。所以这里把失败原样抛给调用方，由 SubmissionForm 区分「真的关着」
 * 和「这次没问到，可以重试」，只在前者显示 disabledMessage。
 */
export async function fetchCorrectionConfig(): Promise<CorrectionConfig> {
  const body = (await requestJson('/api/correction/config')) as Partial<CorrectionConfig> | null
  if (!body || typeof body.enabled !== 'boolean') {
    throw new Error('人机验证配置响应格式不对')
  }
  return {
    enabled: body.enabled,
    turnstileSiteKey: body.turnstileSiteKey ?? null,
    limits: {
      nameMax: body.limits?.nameMax ?? CORRECTION_CONFIG_FALLBACK.limits.nameMax,
      bodyMax: body.limits?.bodyMax ?? CORRECTION_CONFIG_FALLBACK.limits.bodyMax,
    },
  }
}

/** 'meme' 走同一个接口、同一套限流与净化——服务端按 kind 区分归属队列。 */
export async function submitCorrection(input: {
  reporterName: string
  body: string
  kind?: 'correction' | 'meme'
  turnstileToken: string
}): Promise<void> {
  await requestJson('/api/correction', { method: 'POST', body: JSON.stringify(input) })
}
