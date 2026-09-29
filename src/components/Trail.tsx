'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { clearTrail, readTrail, recordTrail, resumeTarget, subscribeTrail, type TrailItem } from '@/lib/trail'
import { SiteText } from './SiteText'

/**
 * 足迹的三个露出点：记录（条目页）、继续（首页 / 录播室）、清单（数据页）。
 * 存储与口径在 `lib/trail.ts`，这里只管怎么摆。
 *
 * **全部都要等挂载后才渲染。** 站是静态导出的，服务端没有 localStorage；
 * 首帧就画足迹会得到一份必然对不上的 HTML，React 会在水合时警告并重画。
 * 所以每个组件都先返回 null，挂载后再出现——这也正好让它表现得像「回来时
 * 才浮出来的一句话」，而不是页面结构的一部分。
 */

const EMPTY: TrailItem[] = []

/**
 * useSyncExternalStore 而不是 useState + useEffect：足迹会被同一页的多个组件
 * 同时读（继续条、看过标记、数据页清单），也会被另一个标签页改。让它们订阅
 * 同一个源，就不会出现「清空了但角落那块还亮着」。
 *
 * getSnapshot 必须返回稳定引用，否则每次渲染都是新数组 → 无限重渲染。
 * 这里用一个缓存：只有 localStorage 的原始串变了才重新解析。
 */
let cachedRaw: string | null = null
let cachedItems: TrailItem[] = EMPTY

function snapshot(): TrailItem[] {
  if (typeof window === 'undefined') return EMPTY
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem('i6i6:trail:v1')
  } catch {
    return EMPTY
  }
  if (raw === cachedRaw) return cachedItems
  cachedRaw = raw
  cachedItems = readTrail()
  return cachedItems
}

export function useTrail(): TrailItem[] {
  return useSyncExternalStore(subscribeTrail, snapshot, () => EMPTY)
}

/**
 * 挂载没挂载。SSR 与首帧一律 false，避免水合不一致。
 *
 * 用 useSyncExternalStore 而不是 useState + useEffect：后者要在 effect 里
 * setState，会被 `react-hooks/set-state-in-effect` 拦下（本仓把它设成 error）。
 * 这里本来就是「读一个 React 之外的事实」，正是这个 hook 的用途——
 * 服务端快照返回 false，客户端快照返回 true，不需要订阅任何东西。
 */
const NEVER_CHANGES = () => () => {}
function useMounted(): boolean {
  return useSyncExternalStore(NEVER_CHANGES, () => true, () => false)
}

/**
 * 条目页挂上它就记一笔，没有任何可见输出。
 *
 * 顺带监听「点了某个来源跳出去」——用的是页面上已有的
 * `data-analytics-event="source.open"` 标记，和埋点同一个约定，
 * 不需要给 EntryWatch 加回调、也不会因为它内部改版而失效。
 * 事件委托在 document 上：来源列表可以切换、重渲染，监听始终有效。
 */
export function TrailRecorder({ id, title, date }: { id: string; title: string; date: string }) {
  useEffect(() => {
    recordTrail({ id, title, date })
  }, [id, title, date])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (!target.closest('[data-analytics-event="source.open"]')) return
      recordTrail({ id, title, date }, { watched: true })
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [id, title, date])

  return null
}

/**
 * 「上次你看到 X」。
 *
 * ## 为什么是浮层而不是页面里的一条
 *
 * 它只在挂载后才知道要不要出现（localStorage 读不到就是没有足迹）。写在文档流里
 * 意味着老访客每次进首页都要经历一次「内容往下跳一格」——首屏是 100svh 的人物屏，
 * 那一跳正好发生在最该安静的地方。浮层没有这个问题，而且这也正是这个功能被
 * 提出来时的样子：像 B 站换设备后右上角那句「上次看到这里」。
 *
 * 位置与显隐见下方 `useNearTopAndAwayFromEnd` 和 className 注释：和 BGM、回到顶部
 * 同排，只在页面顶部附近出现，读列表时绝不压在条目上。
 *
 * 只在**回来**的时候才有意义，所以：当前就停在那一条上时不显示；关掉之后
 * 这一整天不再出现（关闭意图记在一个日期戳里，换一天回来会重新出现一次）。
 */
const DISMISS_KEY = 'i6i6:trail:resume-dismissed'
const DISMISS_EVENT = 'i6i6:trail:resume-dismiss'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function subscribeDismiss(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(DISMISS_EVENT, listener)
  return () => window.removeEventListener(DISMISS_EVENT, listener)
}

/** 返回布尔原始值，所以不需要缓存引用；读不到 storage 就当作没关过。 */
function dismissedSnapshot(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === today()
  } catch {
    return false
  }
}

export function ResumeStrip({ currentId }: { currentId?: string }) {
  const mounted = useMounted()
  const trail = useTrail()
  const dismissed = useSyncExternalStore(subscribeDismiss, dismissedSnapshot, () => true)

  const target = useMemo(() => resumeTarget(trail), [trail])

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISS_KEY, today())
    } catch {
      // 记不住就下次再出现一遍，无所谓。
    }
    window.dispatchEvent(new Event(DISMISS_EVENT))
  }, [])

  const nearTop = useNearTopAndAwayFromEnd()

  if (!mounted || dismissed || !target || target.id === currentId) return null

  // 挂到 body：页面入场动画的 transform 会把 fixed 限制在 main 里（同 BackToTop）。
  return createPortal(
    <aside
      aria-label="接着上次看"
      aria-hidden={!nearTop}
      inert={!nearTop}
      // 单行胶囊，和左下 BGM、右下回到顶部坐在同一排（都是 bottom-5 / sm:bottom-8、h-11），
      // 不再在它们上面另起一条两行高的卡片。回到顶部只在「离开第一屏且往上滚」时出现，
      // 而这条只在第一屏附近出现，两者不会同时占着右下角。
      //
      // 手机左边让出 BGM 展开后的宽度（left-4 + 两个 h-11 按钮 ≈ 6.5rem）；
      // sm 以上固定宽度贴右。底色用和 BGM 同款的半透明 surface + 背景模糊：不加投影（首屏渐变背景上，深色投影会在胶囊四周切出一圈发暗的色块）；它只出现在页面顶部附近，底下不会有需要盖住的正文。
      className={`fixed bottom-5 left-[7rem] right-4 z-40 flex h-11 items-center gap-2 rounded-full border border-live/30 bg-surface/75 pl-4 pr-1.5 backdrop-blur-md transition-[opacity,transform] duration-300 sm:bottom-8 sm:left-auto sm:right-8 sm:w-[min(24rem,calc(100vw-14rem))] ${
        nearTop ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <Link
        prefetch={false}
        href={`/e/${target.id}/`}
        tabIndex={nearTop ? undefined : -1}
        className="ui-press flex min-w-0 flex-1 items-baseline gap-2 text-control text-ink transition-colors hover:text-live"
      >
        <span className="shrink-0 text-meta text-live"><SiteText id="trail-resume" /></span>
        {/* 手机上一行放不下日期，标题更能让人认出是哪一场。 */}
        {target.date && <span className="hidden shrink-0 font-mono text-meta text-faint tnum sm:inline">{target.date}</span>}
        <span className="min-w-0 flex-1 truncate">{target.title}</span>
        <span aria-hidden className="shrink-0 font-mono text-meta text-live">→</span>
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="今天不再提示"
        tabIndex={nearTop ? undefined : -1}
        className="ui-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-meta text-faint transition-colors hover:text-ink"
      >
        ✕
      </button>
    </aside>,
    document.body,
  )
}

/**
 * 「接着上次」只在**刚回来**的那一刻有用：停在页面顶部附近时出现，
 * 一旦往下读（超过半屏）或者到了页尾就收起来，回到顶部再出现。
 *
 * 之前它常驻右下角，录播室短月份滚到底时正好盖住最后一条——也就是最新的那一场，
 * 看起来就像「新条目没出来」。页尾判断单独留着：页面短到滚不过半屏时，
 * 它也不能压在最后几行上。
 */
function useNearTopAndAwayFromEnd(): boolean {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const y = window.scrollY
      const vh = window.innerHeight
      const toEnd = document.documentElement.scrollHeight - (y + vh)
      setVisible(y < vh * 0.5 && toEnd > 160)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    // 切年份 / 月份会改页面高度但不一定滚动，页尾判断要跟着内容变。
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    observer?.observe(document.body)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      observer?.disconnect()
    }
  }, [])
  return visible
}

/** 列表 / 网格里的「看过」标记。极淡，一眼扫过去能看出哪些翻过了，但不抢封面。 */
export function SeenDot({ id, className = '' }: { id: string; className?: string }) {
  const mounted = useMounted()
  const trail = useTrail()
  const item = mounted ? trail.find((row) => row.id === id) : undefined
  if (!item) return null
  return (
    <span
      title={item.watched ? '你点开看过这一场' : '你翻过这一条'}
      className={`inline-flex shrink-0 items-center gap-1 text-meta text-faint ${className}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${item.watched ? 'bg-live' : 'bg-muted/60'}`} />
      <span className="sr-only">{item.watched ? '你点开看过这一场' : '你翻过这一条'}</span>
    </span>
  )
}

/** 数据页的「你的足迹」。全站唯一一个只属于读者自己的数字。 */
export function TrailSection() {
  const mounted = useMounted()
  const trail = useTrail()
  const [confirming, setConfirming] = useState(false)

  if (!mounted) return null

  if (trail.length === 0) {
    return (
      <p className="text-body text-muted">
        <SiteText id="trail-empty" />
      </p>
    )
  }

  const watched = trail.filter((item) => item.watched).length
  const earliest = trail.reduce((oldest, item) => (item.date && item.date < oldest ? item.date : oldest), '9999')

  return (
    <div>
      <p className="measure-body text-body text-muted">
        <SiteText id="trail-summary" vars={{ count: <span className="font-mono text-control font-semibold text-ink tnum">{trail.length}</span> }} />
        {watched > 0 && (
          <SiteText id="trail-summary-watched" vars={{ count: <span className="font-mono text-control font-semibold text-ink tnum">{watched}</span> }} />
        )}
        {earliest !== '9999' && (
          <SiteText id="trail-summary-earliest" vars={{ year: <span className="font-mono text-control font-semibold text-ink tnum">{earliest.slice(0, 4)}</span> }} />
        )}
        。
      </p>

      <ul className="mt-5 divide-y divide-line/50 border-y border-line/50">
        {trail.slice(0, 20).map((item) => (
          <li key={item.id}>
            <Link
              prefetch={false}
              href={`/e/${item.id}/`}
              className="ui-press flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5 transition-colors hover:bg-surface/30"
            >
              <span className="shrink-0 font-mono text-meta text-faint tnum">{item.date || '　'}</span>
              <span className="min-w-0 flex-1 truncate text-control text-muted hover:text-ink">{item.title}</span>
              {item.watched && <span className="shrink-0 text-meta text-live">看过</span>}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {confirming ? (
          <>
            <button
              type="button"
              onClick={() => {
                clearTrail()
                setConfirming(false)
              }}
              className="ui-press rounded-full border border-today/50 bg-today/10 px-4 py-1.5 text-control text-ink hover:border-today"
            >
              确认清空
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="ui-press rounded-full border border-line px-4 py-1.5 text-control text-muted hover:border-muted hover:text-ink"
            >
              算了
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="ui-press rounded-full border border-line px-4 py-1.5 text-control text-muted hover:border-muted hover:text-ink"
          >
            清空足迹
          </button>
        )}
        <p className="text-meta text-faint">
          <SiteText id="trail-privacy" />
        </p>
      </div>
    </div>
  )
}
