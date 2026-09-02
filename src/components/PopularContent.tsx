'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { StatsSection } from './StatsSection'
import { useCopyBlock } from './LiveContentProvider'

/**
 * 「水友们最爱看」——站内内容被点开次数的全期排行。
 *
 * 三件事值得先说清楚：
 *
 * 1. **数据在运行期拉，不烤进静态页。** 站点是静态导出的，排行每天都在变，
 *    所以和其他实时内容一样：首屏什么都不画，拿到数据再补上。接口不可用就
 *    退回一行说明，绝不让数据页因为一个次要板块而空一块。
 * 2. **接口读不到才整节不渲染；读到了但还没数据，照常出现。** 内容服务不可用时
 *    页面上不该留一个「一个问题」的空标题——那看起来像坏了。但「通了只是还没
 *    累计到点击」和「功能压根没上线」在页面上必须看得出区别，否则每次都要上服务器
 *    才知道是哪种。这也是这一节把小节外壳一起画在客户端的原因。
 * 3. **接口只回 ID 和次数。** 标题由构建期生成的静态索引解析
 *    （scripts/popular-index-build.ts）。索引没加载出来时退回显示 ID，
 *    链接照样能点——宁可标题难看，也不要一条都不显示。
 * 4. **这里的链接不上报 content.open。** 否则排行会自己喂自己：排进前十 →
 *    更多人从这里点 → 排得更前。榜单只反映用户在站内其他地方的真实点击。
 */

const CONTENT_ORIGIN = (process.env.NEXT_PUBLIC_CONTENT_ORIGIN ?? '').replace(/\/$/, '')
const REQUEST_TIMEOUT_MS = 4000
const TOP_N = 10

type PopularKind = 'entry' | 'game' | 'series' | 'gallery'
type PopularItem = { targetKey: string; kind: PopularKind; id: string; count: number }
type PopularResponse = {
  countedSince?: string
  totalOpens?: number
  items?: PopularItem[]
}
type LabelIndex = Record<string, { t?: string; d?: string } | undefined>

const KIND_LABEL: Record<PopularKind, string> = { entry: '记录', game: '游戏', series: '节目', gallery: '画廊' }

function hrefFor(item: PopularItem): string {
  if (item.kind === 'entry') return `/e/${item.id}/`
  if (item.kind === 'game') return `/games/${item.id}/`
  if (item.kind === 'series') return `/series/${item.id}/`
  return '/gallery/'
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: 'omit' })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function isPopularItem(value: unknown): value is PopularItem {
  const item = value as PopularItem | undefined
  return Boolean(
    item &&
    typeof item.targetKey === 'string' &&
    typeof item.id === 'string' &&
    typeof item.count === 'number' &&
    item.count > 0 &&
    (item.kind === 'entry' || item.kind === 'game' || item.kind === 'series' || item.kind === 'gallery'),
  )
}

export function PopularContent({
  questionId,
  fallback,
  accent,
  legend,
}: {
  questionId: string
  /** 后台把标题清空时用它——空标题看起来像渲染坏了，不像「有人清空了一个字段」。 */
  fallback: string
  accent: string
  legend: string
}) {
  const question = useCopyBlock('pages', questionId).title || fallback
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [items, setItems] = useState<PopularItem[]>([])
  const [countedSince, setCountedSince] = useState<string | null>(null)
  const [totalOpens, setTotalOpens] = useState<number | null>(null)
  const [labels, setLabels] = useState<LabelIndex>({})

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const data = await fetchJson<PopularResponse>(`${CONTENT_ORIGIN}/api/content/popular?limit=${TOP_N}`)
      if (cancelled) return
      if (!data || !Array.isArray(data.items)) {
        setState('unavailable')
        return
      }
      const ranked = data.items.filter(isPopularItem).slice(0, TOP_N)
      setItems(ranked)
      setCountedSince(typeof data.countedSince === 'string' ? data.countedSince : null)
      setTotalOpens(typeof data.totalOpens === 'number' ? data.totalOpens : null)
      setState('ready')
      if (ranked.length === 0) return
      // 标题索引只在真的有排行时才去取：没有榜单就没必要下载整本目录。
      const index = await fetchJson<{ items?: LabelIndex }>('/data/popular-index.json')
      if (!cancelled && index?.items) setLabels(index.items)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // 还没读完、或者接口根本读不到时才整节不渲染：内容服务不可用不能让数据页
  // 空一块，也不该在页面上立一个「一个问题」的空标题。
  if (state !== 'ready') return null

  // 接口通、只是还没累计到点击——这一节照常出现，只是把话说明白。
  // 空榜单和「功能没上线」看起来一模一样，分不清的话每次都要去查一遍服务器。
  if (items.length === 0) {
    return (
      <StatsSection question={question} accent={accent} legend={legend}>
        <p className="measure-body text-body text-muted">
          还没有累计到点击。等有人在站内点开条目、游戏或节目之后，这里会按次数排出前十。
        </p>
        {countedSince && (
          <p className="mt-6 text-meta text-faint tnum">统计自 {countedSince.slice(0, 10)}</p>
        )}
      </StatsSection>
    )
  }

  const max = Math.max(...items.map((item) => item.count))

  return (
    <StatsSection question={question} accent={accent} legend={legend}>
      <ol className="space-y-3">
        {items.map((item, index) => {
          const label = labels[item.targetKey]
          const title = label?.t || item.id
          return (
            <li key={item.targetKey}>
              <Link href={hrefFor(item)} className="group block">
                <div className="flex items-baseline gap-3">
                  <span className="w-6 shrink-0 text-right font-mono text-meta text-faint tnum">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="line-clamp-2 min-w-0 flex-1 break-words text-body text-muted group-hover:text-ink">{title}</span>
                  <span className="shrink-0 whitespace-nowrap font-mono text-meta text-faint tnum">
                    <span className="text-control font-semibold text-ink">{item.count.toLocaleString()}</span> 次
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-3 pl-9">
                  {/*
                    固定宽度，不是 shrink-0。
                    
                    这一列的内容长短不一（「记录 · 2026-04-28」对「游戏」），而条形图紧跟在它
                    后面。让它按内容撑开的话，每一行的条就从不同的 x 开始——十行下来是十个
                    起点，人眼第一时间读到的不是「谁更长」，而是「这些条没对齐」。
                    条形图的全部意义在于横向比较，起点不齐就等于把这个意义抹掉了。

                    宽度按最长的那种（记录 + 完整日期）取，超出的截断并保留 title。
                  */}
                  <span
                    className="w-[6.5rem] shrink-0 truncate text-meta text-faint tnum"
                    title={`${KIND_LABEL[item.kind]}${label?.d ? ` · ${label.d}` : ''}`}
                  >
                    {KIND_LABEL[item.kind]}
                    {label?.d ? ` · ${label.d}` : ''}
                  </span>
                  <span className="h-[6px] min-w-0 flex-1 overflow-hidden rounded-full bg-raised">
                    <span
                      className="block h-full rounded-full transition-[width,filter] group-hover:brightness-150"
                      style={{ width: `${(item.count / max) * 100}%`, background: accent }}
                    />
                  </span>
                </div>
              </Link>
            </li>
          )
        })}
      </ol>
      <p className="mt-6 text-meta text-faint tnum">
        {countedSince ? `统计自 ${countedSince.slice(0, 10)}` : '统计自建站'}
        {totalOpens !== null ? ` · 站内累计点开 ${totalOpens.toLocaleString()} 次` : ''}
      </p>
    </StatsSection>
  )
}
