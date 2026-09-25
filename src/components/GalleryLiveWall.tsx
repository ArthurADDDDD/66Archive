'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { yearColor } from '@/lib/ui'
import { SiteText } from './SiteText'
import { TimelineRail, type TimelineRailMark } from './TimelineRail'

/**
 * 画廊「全直播合集」：档案里有画面的每一场直播各一帧，按时间铺成一整面墙。
 *
 * 这一页是「图一乐」，所以首要约束是**别给站点添流量、别卡**：
 *
 * - 画面来自预先拼好的年份切片（scripts/live-wall-build.py），不是几千个 `<img>`。每一格用
 *   `background-position` 从切片里取自己那一块，所以格子可以按「小 / 中 / 大」重排列数。
 * - 切片分两档：轻量（128×72 一格）与清晰（240×135，仅 AVIF）。按格子**实际显示宽度**挑
 *   够用的最轻一档——手机默认只拿轻量档；不认 AVIF 的浏览器一律用轻量 WebP。
 * - 一年的格子接近视口（600px 内）才挂背景图；没滚到的年份一个字节都不取。
 * - 清单只在切到这个标签时取，地址带内容哈希，可以长缓存。
 * - 悬停提示自己管自己的状态，指针移动不会让几千个格子重渲染；每年的网格是 memo 的，
 *   选中/取消只重画涉及的那一两年。格子上不放点赞按钮（几千个订阅同一份点赞状态），
 *   点赞在放大视图里。
 *
 * 轻点一格 = 放大看（与照片墙的灯箱同一个习惯）：清晰档切片里那一块放大显示，
 * 点大图进这一场的条目页；左右键 / 左右滑 / ‹ › 翻到相邻场次。
 *
 * 地址：`?view=live` 直接打开这个标签（GalleryBoard 读），`#live-wall-<年>` 跳到那一年，
 * `&d=<条目 id>` 打开时选中那一格并滚过去；选中/取消同步改写地址，面板里可复制链接。
 *
 * 全屏：有 Fullscreen API 用真全屏；iPhone Safari 只给 video 全屏，退而用铺满视口的覆盖层。
 * 全屏时右侧年份轨不出（它跟的是窗口滚动），改由吸顶的年份按钮跳转。
 *
 * ⚠️ 所有 `position: fixed` 的东西（选中面板、悬停提示、全屏覆盖层）都必须**挂到 body**：
 * `<main>` 的入场动画填充模式是 both，结束后仍留着一个单位矩阵 transform，fixed 在它里面会
 * 相对 main 定位——面板会出现在页面几万像素之下（BackToTop 挂 body 是同一个原因）。
 * 全屏时整面墙挂到 body 再请求真全屏，面板与提示留在墙里，否则真全屏下看不见。
 *
 * 之后在后台隐藏的条目按 `hiddenIds` 直接不出格子；点赞 id 加 `lw-` 前缀与照片分开。
 */

type TileKind = 'f' | 'c'
type Tile = [id: string, date: string, title: string, kind: TileKind]
type Slice = { year: string; hd: string; lite: string; liteWebp: string; first: number; count: number }
type Manifest = { version: 2; cols: number; slices: Slice[]; tiles: Tile[] }
type Cell = { index: number; tile: Tile; slice: Slice; offset: number }
type Bucket = { year: string; cells: Cell[] }

type TileSize = 's' | 'm' | 'l'
type Tier = 'hd' | 'lite' | 'liteWebp'

/** 点赞服务里这面墙的 id 前缀：照片 id 与条目 id 字符集相同，不加前缀就可能撞上。 */
export const LIVE_WALL_LIKE_PREFIX = 'lw-'

const SIZE_LABEL: Record<TileSize, string> = { s: '小', m: '中', l: '大' }

/** 列数：手机 / 平板 / 桌面三档。 */
function columnsFor(size: TileSize, width: number) {
  const table = { s: [6, 8, 10], m: [4, 5, 6], l: [2, 3, 4] }[size]
  return width < 640 ? table[0] : width < 1024 ? table[1] : table[2]
}

/**
 * 挑够用的最轻一档：格子显示宽度 × 像素比（封顶 1.5，再高肉眼也看不出这点差别）
 * 不超过 150px 就用轻量档。
 */
function tierFor(cellWidth: number, avif: boolean): Tier {
  if (!avif) return 'liteWebp'
  const need = cellWidth * Math.min(window.devicePixelRatio || 1, 1.5)
  return need <= 150 ? 'lite' : 'hd'
}

/** 1×1 的 AVIF：能解出来就说明浏览器认这个格式。 */
const AVIF_PROBE =
  'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADrbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAETAAAAIQAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAABqaXBycAAAAEtpcGNvAAAAFGlzcGUAAAAAAAAAAQAAAAEAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBAAwAAAAAE2NvbHJuY2x4AAEADQAGgAAAABdpcG1hAAAAAAAAAAEAAQQBAoMEAAAAKW1kYXQSAAoIGAAGiAhoNCAyExlHh4Yhh5555oAAAJBAyRxhQr4='

function probeAvif(): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image.width > 0)
    image.onerror = () => resolve(false)
    image.src = AVIF_PROBE
  })
}

const KIND_NOTE: Record<TileKind, string | null> = {
  f: null,
  c: '录像封面',
}

/** 改写地址栏的一个查询参数，不产生历史记录（与录播室筛选同一做法）。 */
function replaceParam(key: string, value: string | null) {
  const url = new URL(window.location.href)
  if (value === null) url.searchParams.delete(key)
  else url.searchParams.set(key, value)
  if (url.href !== window.location.href) window.history.replaceState(null, '', url)
}

type TipApi = { show: (index: number, x: number, y: number) => void; hide: () => void }

export function GalleryLiveWall({
  hiddenIds,
  manifestUrl,
  renderLike,
}: {
  hiddenIds: string[]
  /** 带内容哈希的清单地址（构建期算好），清单变了地址才变。 */
  manifestUrl: string
  /** 选中面板里的点赞按钮。 */
  renderLike?: (likeId: string) => ReactNode
}) {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [failed, setFailed] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const [size, setSize] = useState<TileSize>('m')
  const [full, setFull] = useState(false)
  const [copied, setCopied] = useState(false)
  const [avif, setAvif] = useState<boolean | null>(null)
  const [width, setWidth] = useState(0)
  const [nearYears, setNearYears] = useState<Set<string>>(() => new Set())
  const rootRef = useRef<HTMLDivElement>(null)
  const wallRef = useRef<HTMLDivElement>(null)
  const tipRef = useRef<TipApi | null>(null)
  /** 选中后要不要把那一格滚到视口中间：来自地址（打开分享链接）时要，自己点的不要。 */
  const scrollToPicked = useRef(false)
  const resumeYear = useRef<string | null>(null)

  const hidden = useMemo(() => new Set(hiddenIds), [hiddenIds])

  // 传给每年网格的回调要稳定，否则 memo 形同虚设：点一格会让所有年份一起重画。
  const togglePick = useCallback((index: number) => {
    setCopied(false)
    setPicked((current) => (current === index ? null : index))
  }, [])

  useEffect(() => {
    let active = true
    void probeAvif().then((ok) => active && setAvif(ok))
    fetch(manifestUrl)
      .then((response) => (response.ok ? (response.json() as Promise<Manifest>) : Promise.reject(new Error(String(response.status)))))
      .then((data) => {
        if (!active) return
        setManifest(data)
        const wanted = new URLSearchParams(window.location.search).get('d')
        const index = wanted ? data.tiles.findIndex((tile) => tile[0] === wanted) : -1
        if (wanted && index >= 0 && !hidden.has(wanted)) {
          scrollToPicked.current = true
          setPicked(index)
        }
      })
      .catch(() => active && setFailed(true))
    return () => {
      active = false
    }
    // 只在挂载时取一次；hidden 来自构建期，不会变。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 格子宽度决定用哪一档切片，所以要知道墙有多宽；只在宽度真变了时才更新。
  useEffect(() => {
    const node = wallRef.current
    if (!node) return
    const measure = () => setWidth((current) => {
      const next = Math.round(node.getBoundingClientRect().width)
      return Math.abs(next - current) > 8 ? next : current
    })
    measure()
    // 与照片墙同一做法：ResizeObserver 之外再挂 resize 兜底，有些环境会压住 RO 回调。
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [manifest, full])

  const years = useMemo<Bucket[]>(() => {
    if (!manifest) return []
    const map = new Map<string, Bucket>()
    for (const slice of manifest.slices) {
      const bucket = map.get(slice.year) ?? { year: slice.year, cells: [] }
      for (let offset = 0; offset < slice.count; offset += 1) {
        const index = slice.first + offset
        const tile = manifest.tiles[index]
        if (!hidden.has(tile[0])) bucket.cells.push({ index, tile, slice, offset })
      }
      map.set(slice.year, bucket)
    }
    return [...map.values()].filter((bucket) => bucket.cells.length > 0)
  }, [manifest, hidden])

  // 右侧年份轨：与照片墙同一套；悬停预览用当年第一张切片的轻量档。
  const marks = useMemo<TimelineRailMark[]>(() => {
    const max = Math.max(1, ...years.map((bucket) => bucket.cells.length))
    return years.map((bucket) => {
      const ratio = bucket.cells.length / max
      const slice = bucket.cells[0].slice
      return {
        id: `live-wall-${bucket.year}`,
        meta: bucket.year,
        title: `${bucket.cells.length} 场`,
        color: yearColor(bucket.year),
        cover: avif === false ? slice.liteWebp : slice.lite,
        weight: (ratio >= 0.6 ? 'lead' : ratio >= 0.25 ? 'major' : 'minor') as TimelineRailMark['weight'],
      }
    })
  }, [years, avif])

  const total = useMemo(() => years.reduce((sum, bucket) => sum + bucket.cells.length, 0), [years])

  // 放大看时的前后翻页顺序（已跳过隐藏条目），以及从格子序号找回它在哪张切片上。
  const order = useMemo(() => years.flatMap((bucket) => bucket.cells.map((cell) => cell.index)), [years])
  const cellByIndex = useMemo(() => new Map(years.flatMap((bucket) => bucket.cells.map((cell) => [cell.index, cell] as const))), [years])

  // 年份分段进入视口 600px 以内才挂背景图；取过的年份留在集合里，滚回去不再闪。
  useEffect(() => {
    if (years.length === 0) return
    const observer = new IntersectionObserver(
      (records) => {
        const reached = records.filter((record) => record.isIntersecting).map((record) => (record.target as HTMLElement).dataset.year!)
        if (reached.length > 0) {
          setNearYears((current) => (reached.every((y) => current.has(y)) ? current : new Set([...current, ...reached])))
        }
      },
      { rootMargin: '600px 0px' },
    )
    for (const node of document.querySelectorAll<HTMLElement>('[data-live-year]')) observer.observe(node)
    return () => observer.disconnect()
  }, [years, full])

  // 地址里带着年份锚点打开时，那一年的分段要等清单到了才存在，浏览器自己的跳转早落空了。
  useEffect(() => {
    if (!manifest || scrollToPicked.current) return
    const hash = decodeURIComponent(window.location.hash.slice(1))
    if (hash.startsWith('live-wall-')) document.getElementById(hash)?.scrollIntoView({ block: 'start' })
  }, [manifest])

  // 选中哪一格就写进地址；清单还没到时不动，免得把分享链接里的 d 先抹掉。
  useEffect(() => {
    if (!manifest) return
    replaceParam('d', picked === null ? null : manifest.tiles[picked][0])
    if (picked !== null && scrollToPicked.current) {
      scrollToPicked.current = false
      window.setTimeout(() => document.querySelector('[data-live-picked]')?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior }), 0)
    }
  }, [manifest, picked])

  // 真全屏被浏览器自己退掉（按 Esc、系统手势）时，状态跟着回来。
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFull(false)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // 墙在 body 与原位之间搬家后：进全屏时请求真全屏（仍在点击的用户激活有效期内），
  // 并把刚才看的那一年接上。
  useEffect(() => {
    const year = resumeYear.current
    resumeYear.current = null
    if (full) {
      const node = rootRef.current
      if (node?.requestFullscreen && !document.fullscreenElement) void node.requestFullscreen().catch(() => {})
    }
    if (year) document.getElementById(`live-wall-${year}`)?.scrollIntoView({ block: 'start' })
  }, [full])

  // 覆盖层模式下锁住页面本身的滚动，否则滚动会穿透到底下的画廊。
  useEffect(() => {
    if (!full) return
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = previous
    }
  }, [full])

  useEffect(() => {
    if (picked === null || full) return
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = previous
    }
  }, [picked, full])

  // 切走标签（组件卸载）时一并退出全屏。
  useEffect(() => () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }, [])

  // Esc 先收起选中的那一格，再退覆盖层（真全屏下 Esc 由浏览器自己处理）。
  useEffect(() => {
    if (picked === null && !full) return
    const onKey = (event: KeyboardEvent) => {
      if (picked !== null && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        const at = order.indexOf(picked)
        if (at < 0) return
        const next = order[(at + (event.key === 'ArrowLeft' ? -1 : 1) + order.length) % order.length]
        scrollToPicked.current = true
        setPicked(next)
        return
      }
      if (event.key !== 'Escape') return
      if (picked !== null) setPicked(null)
      else setFull(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picked, full, order])

  const columns = columnsFor(size, width || 1024)
  const tier: Tier | null = avif === null || width === 0 ? null : tierFor(width / columns, avif)

  /** 视口里最靠上的那一年；进出全屏时据此接着看同一年，而不是跳回开头。 */
  const currentYear = () => {
    const sections = [...document.querySelectorAll<HTMLElement>('[data-live-year]')]
    return sections.find((node) => node.getBoundingClientRect().bottom > 120)?.dataset.year ?? null
  }
  const enterFull = () => {
    resumeYear.current = currentYear()
    setFull(true)
  }
  const exitFull = () => {
    resumeYear.current = currentYear()
    setFull(false)
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }

  const pick = (index: number | null) => {
    setCopied(false)
    setPicked(index)
  }

  const copyLink = (id: string) => {
    const url = new URL(window.location.href)
    url.hash = ''
    url.searchParams.set('view', 'live')
    url.searchParams.set('d', id)
    void navigator.clipboard?.writeText(url.href).then(() => setCopied(true), () => {})
  }

  const jumpToYear = (year: string) => {
    document.getElementById(`live-wall-${year}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#live-wall-${year}`)
  }

  const tiles = manifest?.tiles
  const pickedTile = picked === null || !tiles ? null : tiles[picked]

  // 浮层：平时挂 body；全屏时整面墙已经挂在 body 上，浮层留在墙里（真全屏只显示这一棵子树）。
  const float = (node: ReactNode) => (full ? node : createPortal(node, document.body))

  const wall = (
    <div
      ref={rootRef}
      className={full ? 'fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-base px-page pb-24' : undefined}
    >
      {failed && <p className="py-16 text-center text-meta text-faint">合集清单暂时没有加载成功，稍后再试。</p>}
      {!failed && !manifest && <p className="py-16 text-center text-meta text-faint">正在铺开……</p>}

      {manifest && (
        <>
          <p className={`measure-body mb-5 text-body leading-relaxed text-muted tnum ${full ? 'hidden' : ''}`}>
            <SiteText
              id="gallery-live-intro"
              vars={{ count: total, from: years[0]?.cells[0].tile[1] ?? '', to: years.at(-1)?.cells.at(-1)?.tile[1] ?? '' }}
            />
          </p>

          <div className={`mb-6 flex items-center gap-2 sm:mb-8 sm:items-start sm:gap-3 ${full ? 'sticky top-0 z-10 -mx-page bg-base/95 px-page py-3 backdrop-blur' : ''}`}>
            {/* 手机上年份按钮排成一行横滑：十二个按钮折成四行会把图墙推出首屏。 */}
            <nav
              className="-my-1 flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden"
              aria-label="跳到年份"
            >
              {years.map((bucket) => (
                <a
                  key={bucket.year}
                  href={`#live-wall-${bucket.year}`}
                  onClick={(event) => {
                    event.preventDefault()
                    jumpToYear(bucket.year)
                  }}
                  className="ui-press shrink-0 whitespace-nowrap rounded-full border border-line/80 px-3 py-1.5 text-meta text-muted tnum transition-colors hover:border-today/60 hover:text-today"
                >
                  {bucket.year}<span className="hidden sm:inline"> · {bucket.cells.length}</span>
                </a>
              ))}
            </nav>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <div className="flex items-center gap-0.5 rounded-full border border-line/80 bg-surface/50 p-0.5" role="group" aria-label="格子大小">
                {(Object.keys(SIZE_LABEL) as TileSize[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSize(value)}
                    aria-pressed={size === value}
                    className={`ui-press min-h-8 min-w-8 rounded-full px-2 text-meta transition-colors ${
                      size === value ? 'bg-raised text-ink' : 'text-faint hover:text-muted'
                    }`}
                  >
                    {SIZE_LABEL[value]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={full ? exitFull : enterFull}
                aria-pressed={full}
                aria-label={full ? '退出全屏' : '全屏'}
                className="ui-press min-h-9 shrink-0 whitespace-nowrap rounded-full border border-line/80 bg-surface/50 px-3 text-meta text-muted transition-colors hover:border-today/60 hover:text-today"
              >
                {full ? '✕' : '⤢'}<span className="hidden sm:inline">{full ? ' 退出全屏' : ' 全屏'}</span>
              </button>
            </div>
          </div>

          {!full && (
            <TimelineRail
              marks={marks}
              ariaLabel="全直播合集年份时间轴"
              positionLabel="全直播合集浏览位置"
              showFrom="md"
              reserveBottom
              height="clamp(20rem,60vh,44rem)"
              magnify={{ radius: 0.14, scale: 2.4 }}
            />
          )}

          <div ref={wallRef} className={`space-y-6 sm:space-y-8 ${full ? '' : 'gallery-wall'}`}>
            {years.map((bucket) => (
              <YearGrid
                key={bucket.year}
                bucket={bucket}
                cols={manifest.cols}
                columns={columns}
                gap={size === 's' ? 0 : size === 'm' ? 2 : 4}
                tier={nearYears.has(bucket.year) ? tier : null}
                pickedIndex={picked !== null && bucket.cells.some((cell) => cell.index === picked) ? picked : null}
                full={full}
                onPick={togglePick}
                tipRef={tipRef}
              />
            ))}
          </div>

          <p className={`mt-8 text-meta text-faint ${full ? 'hidden' : ''}`}><SiteText id="gallery-live-note" /></p>

          {float(<HoverTip tiles={manifest.tiles} apiRef={tipRef} suppressed={picked !== null} />)}
        </>
      )}

      {pickedTile && picked !== null && float(
        <LiveLightbox
          tile={pickedTile}
          cell={cellByIndex.get(picked) ?? null}
          cols={manifest?.cols ?? 10}
          tier={avif === false ? 'liteWebp' : 'hd'}
          position={order.indexOf(picked)}
          total={order.length}
          copied={copied}
          renderLike={renderLike}
          onStep={(delta) => {
            const at = order.indexOf(picked)
            if (at < 0 || order.length === 0) return
            scrollToPicked.current = true
            pick(order[(at + delta + order.length) % order.length])
          }}
          onCopy={() => copyLink(pickedTile[0])}
          onClose={() => pick(null)}
        />,
      )}
    </div>
  )

  return full && typeof document !== 'undefined' ? createPortal(wall, document.body) : wall
}

/**
 * 一年的网格。memo 住：悬停不经过这里，选中只影响选中格所在的那一年，
 * 切「小 / 中 / 大」或换档才整体重排。
 */
const YearGrid = memo(function YearGrid({
  bucket,
  cols,
  columns,
  gap,
  tier,
  pickedIndex,
  full,
  onPick,
  tipRef,
}: {
  bucket: Bucket
  cols: number
  columns: number
  gap: number
  /** null = 还没滚到附近，不挂背景图。 */
  tier: Tier | null
  pickedIndex: number | null
  full: boolean
  onPick: (index: number) => void
  tipRef: React.RefObject<TipApi | null>
}) {
  const indexOf = (target: EventTarget) => {
    const node = (target as HTMLElement).closest<HTMLElement>('[data-i]')
    return node ? Number(node.dataset.i) : null
  }

  return (
    <section
      id={`live-wall-${bucket.year}`}
      data-live-year=""
      data-year={bucket.year}
      className={full ? 'scroll-mt-32' : 'scroll-mt-24'}
    >
      <h3 className="mb-2 flex items-baseline gap-3 text-control">
        <span className="font-mono font-semibold tnum" style={{ color: yearColor(bucket.year) }}>{bucket.year}</span>
        <span className="text-meta text-faint tnum">{bucket.cells.length} 场</span>
      </h3>
      <div
        role="img"
        aria-label={`${bucket.year} 年 ${bucket.cells.length} 场直播的截图`}
        className="grid cursor-crosshair select-none"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: `${gap}px` }}
        onPointerMove={(event) => {
          if (event.pointerType !== 'mouse') return
          const index = indexOf(event.target)
          if (index === null) tipRef.current?.hide()
          else tipRef.current?.show(index, event.clientX, event.clientY)
        }}
        onPointerLeave={() => tipRef.current?.hide()}
        onClick={(event) => {
          const index = indexOf(event.target)
          if (index !== null) onPick(index)
        }}
      >
        {bucket.cells.map(({ index, tile, slice, offset }) => {
          const rows = Math.ceil(slice.count / cols)
          const col = offset % cols
          const row = Math.floor(offset / cols)
          const isPicked = index === pickedIndex
          return (
            <div
              key={tile[0]}
              data-i={index}
              data-live-picked={isPicked ? '' : undefined}
              className={`relative aspect-video bg-raised bg-no-repeat ${isPicked ? 'z-[1] outline outline-2 -outline-offset-2 outline-today' : ''}`}
              style={tier ? {
                backgroundImage: `url("${slice[tier]}")`,
                backgroundSize: `${cols * 100}% ${rows * 100}%`,
                backgroundPosition: `${cols > 1 ? (col / (cols - 1)) * 100 : 0}% ${rows > 1 ? (row / (rows - 1)) * 100 : 0}%`,
              } : undefined}
            />
          )
        })}
      </div>
    </section>
  )
})

/** 悬停提示：状态只在这里，指针每动一下只重画这一小块。 */
function HoverTip({
  tiles,
  apiRef,
  suppressed,
}: {
  tiles: Tile[]
  apiRef: React.RefObject<TipApi | null>
  suppressed: boolean
}) {
  const [state, setState] = useState<{ index: number; x: number; y: number } | null>(null)

  useEffect(() => {
    apiRef.current = {
      show: (index, x, y) => setState({ index, x, y }),
      hide: () => setState(null),
    }
    return () => {
      apiRef.current = null
    }
  }, [apiRef])

  if (!state || suppressed) return null
  return (
    <div
      className="pointer-events-none fixed z-40 max-w-[18rem] rounded-md border border-line bg-surface/95 px-3 py-2 text-meta shadow-lg backdrop-blur"
      style={{ left: Math.min(state.x + 14, window.innerWidth - 300), top: state.y + 16 }}
    >
      <TileLabel tile={tiles[state.index]} />
    </div>
  )
}

function TileLabel({ tile }: { tile: Tile }) {
  const [, date, title, kind] = tile
  const note = KIND_NOTE[kind]
  return (
    <>
      <span className="font-mono text-faint tnum">{date}</span>
      <span className="ml-2 text-ink">{title}</span>
      {note && <span className="ml-2 text-faint">（{note}）</span>}
    </>
  )
}

/**
 * 放大看一格。底色不用 backdrop-blur：身后是几千个带背景图的格子，整屏模糊在中端手机上
 * 每帧都要重算，打开 / 翻页会明显卡。画面仍取自切片（清晰档一格 240×135），所以最大只放到 480px 宽——
 * 再大就糊了；要看清楚就点进条目页看录像。
 */
function LiveLightbox({
  tile,
  cell,
  cols,
  tier,
  position,
  total,
  copied,
  renderLike,
  onStep,
  onCopy,
  onClose,
}: {
  tile: Tile
  cell: Cell | null
  cols: number
  tier: Tier
  position: number
  total: number
  copied: boolean
  renderLike?: (likeId: string) => ReactNode
  onStep: (delta: number) => void
  onCopy: () => void
  onClose: () => void
}) {
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const rows = cell ? Math.ceil(cell.slice.count / cols) : 1
  const col = cell ? cell.offset % cols : 0
  const row = cell ? Math.floor(cell.offset / cols) : 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${tile[1]} ${tile[2]}`}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-base/95 px-page"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      onTouchStart={(event) => {
        const touch = event.touches[0]
        swipe.current = { x: touch.clientX, y: touch.clientY }
      }}
      onTouchEnd={(event) => {
        const start = swipe.current
        swipe.current = null
        if (!start) return
        const touch = event.changedTouches[0]
        const dx = touch.clientX - start.x
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(touch.clientY - start.y)) onStep(dx < 0 ? 1 : -1)
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭"
        className="ui-press absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-line/80 bg-surface/80 text-muted hover:text-ink sm:right-6 sm:top-6"
      >
        ✕
      </button>

      <figure className="w-full max-w-[30rem]">
        <Link
          prefetch={false}
          href={`/e/${tile[0]}/`}
          aria-label={`看这一场：${tile[1]} ${tile[2]}`}
          className="ui-press block aspect-video w-full overflow-hidden rounded-lg border border-line bg-raised bg-no-repeat shadow-2xl"
          style={cell ? {
            backgroundImage: `url("${cell.slice[tier]}")`,
            backgroundSize: `${cols * 100}% ${rows * 100}%`,
            backgroundPosition: `${cols > 1 ? (col / (cols - 1)) * 100 : 0}% ${rows > 1 ? (row / (rows - 1)) * 100 : 0}%`,
          } : undefined}
        />
        <figcaption className="mt-3 text-control leading-relaxed">
          <TileLabel tile={tile} />
        </figcaption>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onStep(-1)}
            aria-label="上一场"
            className="ui-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line/80 text-muted hover:text-ink"
          >
            ‹
          </button>
          <span className="shrink-0 font-mono text-meta text-faint tnum">{position + 1} / {total}</span>
          <button
            type="button"
            onClick={() => onStep(1)}
            aria-label="下一场"
            className="ui-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line/80 text-muted hover:text-ink"
          >
            ›
          </button>
          <span className="flex-1" />
          {renderLike?.(LIVE_WALL_LIKE_PREFIX + tile[0])}
          <button
            type="button"
            onClick={onCopy}
            className="ui-press hidden shrink-0 rounded-sm text-meta text-muted underline decoration-line underline-offset-4 hover:text-ink sm:inline"
          >
            {copied ? '已复制' : '复制链接'}
          </button>
          <Link
            prefetch={false}
            href={`/e/${tile[0]}/`}
            className="ui-press shrink-0 whitespace-nowrap rounded-sm text-meta text-live underline decoration-live/40 underline-offset-4 hover:text-ink"
          >
            看这一场 →
          </Link>
        </div>
      </figure>
    </div>
  )
}
