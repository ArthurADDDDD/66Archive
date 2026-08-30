'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getBilibiliVideoMeta } from '@/lib/bilibili'
import { detectPlatform, PLATFORM_META, SOURCE_KIND_LABEL, proxyImage } from '@/lib/platforms'
import { analyticsSourceTarget } from '@/lib/site-analytics'

/**
 * 一场记录的「观看台」。
 *
 * 重构前这一页把「去哪儿看」拆成互不相干的两块：分段列表永远跳第一条 alive 来源，
 * 下面的来源清单选了别的也没人理它。这里把两块合并到同一份状态上——
 * **选中的来源决定所有跳转**，封面也跟着选中的来源换。
 *
 * 分段列表（这场里在打什么）是纯预览，不可点：色带 hover / 点一下只是把对应行
 * 高亮、滚到可见区，不打开任何链接。真正「点了就去看」的动作全部收在右侧的
 * 来源面板里——大封面卡、主 CTA、来源切换按钮。两处职责分开：左边回答
 * 「这场播了什么」，右边回答「去哪儿看」，不要在分段行上再叠一层跳转。
 */

export type WatchSource = {
  url: string
  kind: string
  status: 'alive' | 'dead' | 'unchecked'
  cover?: string
  parts?: number
  partDetails?: { page: number; title: string; duration_sec?: number; cover?: string }[]
  accountName?: string
  /** 来源原本所属条目的标题；同场多录像时用来区分版本 */
  entryTitle: string
  /** 见 schema 里的注释：平台按视频整体返回的封面对这个来源不准确，展示层不应该拿它兜底。 */
  coverUnreliable?: boolean
}

export type WatchSegment = {
  at: string
  atSec: number
  endSec: number
  /** 游戏名（有 game 时）或原始 label */
  name: string
  label: string
  gameId: string | null
  color: string
  /** 这一段没有游戏、而整场又是按游戏分的——弱化，别和真正的游戏段抢眼 */
  dim: boolean
  /** 在整场时长里的占比；时长未知时退化为按段数等分 */
  from: number
  to: number
}

export function EntryWatch({
  sources,
  segments,
  totalSec,
  accent,
  gameNames,
  entryCover,
  entryTitle,
}: {
  sources: WatchSource[]
  segments: WatchSegment[]
  totalSec: number
  accent: string
  /** segments 为空时用来交代「已知涉及哪些游戏」，不留一句干巴巴的「暂无」 */
  gameNames: string[]
  /** 条目级封面兜底；来源自己的封面优先 */
  entryCover: string | null
  entryTitle: string
}) {
  const defaultIndex = Math.max(0, sources.findIndex((s) => s.status === 'alive'))
  const [sourceIndex, setSourceIndex] = useState(defaultIndex)
  // hover 是临时的（指针离开就还原），pinned 是点出来的（会一直留着）
  const [hovered, setHovered] = useState<number | null>(null)
  const [pinned, setPinned] = useState<number | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<(HTMLLIElement | null)[]>([])

  const active = hovered ?? pinned
  const source = sources[sourceIndex]
  const sourcePlatform = source ? detectPlatform(source.url) : null
  const sourceMeta = sourcePlatform ? PLATFORM_META[sourcePlatform] : undefined
  const sourceLabel = sourceMeta?.name ?? (source ? hostLabel(source.url) : '原平台')
  const hasDuration = totalSec > 0
  const leadRatio = hasDuration ? (segments[0]?.from ?? 0) : 0

  // 整点刻度：让色带能当「时间轴」读，而不只是一条彩色胶囊
  const ticks = useMemo(() => {
    if (!hasDuration) return []
    const step = totalSec > 6 * 3600 ? 2 * 3600 : 3600
    const out: { at: number; label: string }[] = []
    for (let t = step; t < totalSec; t += step) {
      out.push({ at: t / totalSec, label: `${Math.round(t / 3600)}h` })
    }
    return out
  }, [hasDuration, totalSec])

  // 色带背景：一条 linear-gradient，硬停靠点，段与段之间不留缝也不叠色。
  const gradient = useMemo(() => {
    if (segments.length === 0) return 'transparent'
    const stops: string[] = []
    if (leadRatio > 0) stops.push(`${withAlpha('#2C3140', 0.7)} 0 ${leadRatio * 100}%`)
    for (const s of segments) {
      stops.push(`${withAlpha(s.color, s.dim ? 0.4 : 0.85)} ${s.from * 100}% ${s.to * 100}%`)
    }
    return `linear-gradient(to right, ${stops.join(', ')})`
  }, [segments, leadRatio])

  const indexAtRatio = (ratio: number) => {
    for (let i = segments.length - 1; i >= 0; i--) {
      if (ratio >= segments[i].from) return i
    }
    return null
  }

  const onBarPointer = (clientX: number, pin: boolean) => {
    const el = barRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    const index = indexAtRatio(ratio)
    setHovered(index)
    if (pin && index !== null) {
      setPinned(index)
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      rowRefs.current[index]?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20.5rem] lg:items-start lg:gap-12">
      {/* 时间轴：桌面在左（内容主体），手机在下（先选来源，再挑时间点） */}
      <div className="order-2 min-w-0 lg:order-1">
        <SectionTitle
          title="这场里在打什么"
          hint={
            segments.length === 0
              ? undefined
              : hasDuration
                ? '把指针放到色带上可以预读某一段；点一下定位到下面的列表。'
                : '这场时长未知，色带按段数等分，宽度不代表真实时长。'
          }
        />

        {segments.length === 0 ? (
          <p className="mt-4 text-body text-muted">
            尚未录入分段信息。
            {gameNames.length > 0 && <> 已知涉及：{gameNames.join('、')}。</>}
          </p>
        ) : (
          <>
            {/* 色带 = 索引。整条是一个指针目标，不切成一堆 2px 的小按钮。 */}
            <div className="mt-4">
              <div
                ref={barRef}
                aria-hidden="true"
                onPointerMove={(e) => onBarPointer(e.clientX, false)}
                onPointerLeave={() => setHovered(null)}
                onPointerDown={(e) => onBarPointer(e.clientX, true)}
                className="relative h-10 w-full touch-pan-y select-none overflow-hidden rounded-lg bg-raised sm:h-11"
                style={{ cursor: 'crosshair' }}
              >
                {/* 一层渐变画完所有分段：分开画会在每个分界处露出 1px 的缝或叠色，
                    20 段的直播于是被切成看着像刻度、其实什么也不表示的条纹。 */}
                <span className="absolute inset-0" style={{ background: gradient }} />

                {/* 高亮当前段：不改分段本身的透明度，只在它左右各压一层暗幕。 */}
                {active !== null && segments[active] && (
                  <>
                    <span
                      className="pointer-events-none absolute inset-y-0 left-0 bg-base/55 transition-[width] duration-150"
                      style={{ width: `${segments[active].from * 100}%` }}
                    />
                    <span
                      className="pointer-events-none absolute inset-y-0 right-0 bg-base/55 transition-[width] duration-150"
                      style={{ width: `${Math.max(0, 1 - segments[active].to) * 100}%` }}
                    />
                    <span
                      className="pointer-events-none absolute inset-y-0"
                      style={{
                        left: `${segments[active].from * 100}%`,
                        width: `${Math.max(0, segments[active].to - segments[active].from) * 100}%`,
                        boxShadow: 'inset 0 0 0 1px rgba(230,228,239,0.55)',
                      }}
                    />
                  </>
                )}

                {ticks.map((t) => (
                  <span
                    key={t.at}
                    style={{ left: `${t.at * 100}%` }}
                    className="pointer-events-none absolute inset-y-0 w-px bg-base/50"
                  />
                ))}
              </div>

              {/* 刻度标签 + 读数：色带上看到的一切，这里都有文字版 */}
              <div className="relative mt-1.5 h-4">
                {ticks.map((t) => (
                  <span
                    key={t.at}
                    style={{ left: `${t.at * 100}%` }}
                    className="absolute -translate-x-1/2 font-mono text-[10px] text-faint tnum"
                  >
                    {t.label}
                  </span>
                ))}
              </div>

              <p className="mt-1 min-h-[1.4rem] text-meta text-muted tnum" aria-live="polite">
                {active !== null && segments[active] ? (
                  <>
                    <span className="font-mono text-ink">{segments[active].at}</span>
                    <span className="mx-2 text-line">·</span>
                    <span className="text-ink">{segments[active].name}</span>
                    <span className="mx-2 text-line">·</span>
                    <span className="text-faint">{formatSpan(segments[active].endSec - segments[active].atSec)}</span>
                  </>
                ) : (
                  <span className="text-faint">
                    共 {segments.length} 段{hasDuration ? ` · ${formatSpan(totalSec)}` : ''}
                  </span>
                )}
              </p>
            </div>

            {/* 列表 = 预览，不是动作。点右侧「在哪儿看」的来源才是真正打开视频；
                这里只回答「这场几点在打什么」，所以整行不做成链接——
                hover 依然会联动上面的色带高亮，方便对着色带找对应的那一段。 */}
            <ol className="mt-3 divide-y divide-line/60 border-y border-line/60">
              {segments.map((s, i) => {
                const isActive = active === i
                return (
                  <li
                    key={i}
                    ref={(el) => {
                      rowRefs.current[i] = el
                    }}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    className={`grid min-h-[3rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 scroll-mt-24 px-2 py-2 transition-colors ${
                      isActive ? 'bg-surface/70' : ''
                    }`}
                  >
                    <span className="flex shrink-0 items-center gap-2.5">
                      <span aria-hidden className="h-6 w-1 shrink-0 rounded-full" style={{ background: s.color }} />
                      <span className="font-mono text-meta text-faint tnum">{s.at}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-body text-ink">{s.name}</span>
                      {s.gameId && <span className="block truncate text-meta text-faint">{s.label}</span>}
                    </span>
                    {s.endSec > s.atSec && (
                      <span className="shrink-0 text-right font-mono text-meta text-faint tnum">
                        {formatSpan(s.endSec - s.atSec)}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          </>
        )}
      </div>

      {/* 来源面板：桌面吸附在右侧（列表再长也够得着），手机排在最上（先决定去哪儿看） */}
      <aside className="order-1 lg:order-2 lg:sticky lg:top-6">
        <EntryCover source={source} entryCover={entryCover} entryTitle={entryTitle} accent={accent} />

        <div className="mt-6">
          <SectionTitle title="在哪儿看" hint={sources.length > 1 ? `${sources.length} 个来源，选中的那个决定所有跳转与上面的封面。` : undefined} />

          {!source ? (
            <p className="mt-4 rounded-xl border border-line bg-surface/40 px-4 py-4 text-body text-muted">
              还没有可用链接。如果你手上有，欢迎补录。
            </p>
          ) : (
            <div className="mt-4">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                data-analytics-event="source.open"
                data-analytics-target={analyticsSourceTarget(sourcePlatform)}
                className="ui-press flex min-h-[3rem] w-full max-w-sm items-center justify-center gap-2 rounded-full px-5 text-control font-semibold text-[#12141C] lg:max-w-none"
                style={{ background: source.status === 'dead' ? '#7C8296' : accent }}
              >
                在 {sourceLabel} 打开
                <span aria-hidden className="font-mono">↗</span>
              </a>
              {sources.length === 1 && (
                <p className="mt-2 text-meta text-faint">
                  {SOURCE_KIND_LABEL[source.kind] ?? source.kind}
                  {source.accountName ? ` · ${source.accountName}` : ''}
                  {(source.parts ?? source.partDetails?.length) ? ` · ${source.parts ?? source.partDetails?.length}P` : ''}
                </p>
              )}
              {source.status === 'dead' && (
                <p className="mt-2 text-meta text-faint">这条来源上次检查时已失效，打开可能是 404。</p>
              )}
              {source.status === 'unchecked' && (
                <p className="mt-2 text-meta text-faint">这条来源尚未核验，不保证还能打开。</p>
              )}

              {/* 用 aria-pressed 的切换按钮，不用 radiogroup——radio 语义会向读屏承诺方向键切换，
                  而这里就是一组普通按钮，Tab 逐个走。EntryRow 的来源切换也是这套。 */}
              {sources.length > 1 && (
                <div role="group" aria-label="选择来源" className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {sources.map((s, i) => {
                    const platform = detectPlatform(s.url)
                    const meta = platform ? PLATFORM_META[platform] : undefined
                    const selected = i === sourceIndex
                    return (
                      <button
                        key={s.url}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSourceIndex(i)}
                        className={`ui-press flex w-full min-h-[3.25rem] items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                          selected
                            ? 'border-live/55 bg-live/10'
                            : 'border-line bg-surface/40 hover:border-muted hover:bg-surface/70'
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full border ${selected ? 'border-live bg-live' : 'border-line'}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-meta">
                            <span className="font-semibold" style={{ color: meta?.color }}>
                              {meta?.name ?? hostLabel(s.url)}
                            </span>
                            <span className="text-muted">{SOURCE_KIND_LABEL[s.kind] ?? s.kind}</span>
                            {s.accountName && <span className="text-faint">{s.accountName}</span>}
                            {(s.parts ?? s.partDetails?.length) && (
                              <span className="rounded-full border border-line px-1.5 font-mono text-[10px] text-live tnum">
                                {s.parts ?? s.partDetails?.length}P
                              </span>
                            )}
                            {s.status === 'dead' && <span className="text-faint">已失效</span>}
                          </span>
                          <span className="mt-0.5 block truncate text-meta text-faint">{s.entryTitle}</span>
                        </span>
                        <span className={`shrink-0 self-center text-meta ${selected ? 'text-live' : 'text-faint'}`}>
                          {selected ? '当前' : '选它'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              <SourceParts source={source} />
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h2 className="text-h3 font-semibold text-ink">{title}</h2>
      {hint && <p className="mt-1.5 text-meta text-faint">{hint}</p>}
    </div>
  )
}

/**
 * 封面卡：跟着选中的来源换，点击直接打开那个来源——它不是装饰图，是这个来源的入口。
 * 取图优先级：来源自己的封面 → 来源分 P 里第一段的封面 → B 站元数据兜底（客户端异步）→ 条目级封面。
 */
function EntryCover({
  source,
  entryCover,
  entryTitle,
  accent,
}: {
  source: WatchSource | undefined
  entryCover: string | null
  entryTitle: string
  accent: string
}) {
  const sourceCover = proxyImage(source?.cover ?? source?.partDetails?.[0]?.cover, 960)
  const coverUnreliable = Boolean(source?.coverUnreliable)
  const [fallback, setFallback] = useState<{ url: string; cover: string | null } | null>(null)
  const sourceUrl = source?.url

  useEffect(() => {
    if (sourceCover || !sourceUrl || coverUnreliable) return
    let cancelled = false
    getBilibiliVideoMeta(sourceUrl).then((meta) => {
      if (!cancelled) setFallback({ url: sourceUrl, cover: meta?.cover ? proxyImage(meta.cover, 960) : null })
    })
    return () => {
      cancelled = true
    }
  }, [sourceCover, sourceUrl, coverUnreliable])

  const cover =
    sourceCover ??
    (coverUnreliable ? null : fallback && fallback.url === sourceUrl ? fallback.cover : null) ??
    proxyImage(entryCover ?? undefined, 960)

  const image = cover ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={cover} alt={`${entryTitle} 封面`} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-video/12 via-raised to-live/8 p-6">
      <span className="text-center text-meta tracking-widest text-faint">封面待补</span>
    </div>
  )

  if (!source) {
    return <div className="aspect-video w-full overflow-hidden rounded-xl border border-line bg-raised">{image}</div>
  }

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      data-analytics-event="source.open"
      data-analytics-target={analyticsSourceTarget(detectPlatform(source.url))}
      aria-label={`打开 ${entryTitle} 的来源`}
      className="ui-press group/cover relative block aspect-video w-full overflow-hidden rounded-xl border border-line bg-raised"
    >
      {image}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-60 transition-opacity duration-300 group-hover/cover:opacity-85" />
      <span
        className="pointer-events-none absolute bottom-3 right-3 rounded-full border border-white/20 bg-black/55 px-2.5 py-1 text-meta text-white backdrop-blur-sm"
        style={{ borderColor: `${accent}55` }}
      >
        打开来源 ↗
      </span>
    </a>
  )
}

/** 当前来源自己的分 P。不同来源不共用——所以它跟着 source 走，放在来源面板里。
 * 没有逐 P 标题时干脆不显示这一块，不向用户暴露「数据还没录全」这种内部状态。 */
function SourceParts({ source }: { source: WatchSource }) {
  if (!source.partDetails?.length) return null
  return (
    <section className="ui-content-swap mt-3 rounded-xl border border-line bg-surface/30 p-2" aria-label="当前来源的分 P">
      <p className="px-1 pb-2 pt-1 text-meta uppercase tracking-[0.16em] text-faint">
        当前来源的分 P · {source.partDetails.length}P
      </p>
      <ol className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
        {source.partDetails.map((part) => {
          const cover = proxyImage(part.cover, 180)
          return (
            <li key={part.page}>
              <a
                href={partHref(source.url, part.page)}
                target="_blank"
                rel="noopener noreferrer"
                data-analytics-event="source.open"
                data-analytics-target={analyticsSourceTarget(detectPlatform(source.url))}
                className="ui-press group/part flex min-h-[3rem] items-center gap-2.5 rounded-lg border border-transparent bg-base/30 p-1.5 transition-colors hover:border-live/35 hover:bg-live/10"
              >
                <span className="relative h-10 w-[4.5rem] shrink-0 overflow-hidden rounded-md bg-raised">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center font-mono text-meta text-faint">P{part.page}</span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-meta leading-snug text-muted group-hover/part:text-ink">{part.title}</span>
                  {part.duration_sec && (
                    <span className="mt-0.5 block font-mono text-[10px] text-faint tnum">{formatSpan(part.duration_sec)}</span>
                  )}
                </span>
                <span aria-hidden className="shrink-0 font-mono text-meta text-live">↗</span>
              </a>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** #RRGGBB → rgba()。整条色带是一层渐变，透明度必须烘进颜色里。 */
function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const n = parseInt(value.length === 3 ? value.replace(/./g, (c) => c + c) : value, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** 站点没登记的平台（A 站等）：显示域名，不写「未知平台」这种什么也没说的词。 */
function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return '原平台'
  }
}

function partHref(sourceUrl: string, page: number): string {
  try {
    const url = new URL(sourceUrl)
    url.searchParams.set('p', String(page))
    return url.toString()
  } catch {
    return sourceUrl
  }
}

/** 秒 → 「3 小时 45 分」/「43 分」/「50 秒」。分段动辄跨小时，不能只给分钟。 */
function formatSpan(seconds: number): string {
  if (seconds <= 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return m ? `${h} 小时 ${m} 分` : `${h} 小时`
  if (m > 0) return `${m} 分`
  return `${seconds} 秒`
}
