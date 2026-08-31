'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { bucketOf, sortBucket, UNDATED, UNDATED_LABEL, type GalleryPhoto } from '@/lib/gallery-photos'
import { gallerySourceHref } from '@/lib/gallery-href'
import { SearchField } from './SearchField'

/**
 * 画廊改版：总览优先的「年份底片架」。
 *
 * 三条设计决定，都是被素材本身逼出来的：
 *
 * 1. 不做首页那种整屏推进的叙事流。找图的人需要一次看见很多张，而不是被一屏一屏喂。
 * 2. 横竖大小混排，默认按真实宽高比做等高行（justified rows）——每行铺满、行高一致，
 *    竖图不被裁成方块，视线扫过去边缘是齐的，不会锯齿。需要快速点数量时切「整齐」模式。
 * 3. 年份是唯一的一级结构。顶部年份谱既是总览（一眼看出哪年多哪年少），也是跳转控件。
 *
 * 图注一律不编：清单里 title 为 null 时只显示日期与时间，绝不用文件名凑一个像样的标题。
 */

type ViewMode = 'natural' | 'uniform'
type Density = 'loose' | 'normal' | 'dense'
type CollectionMode = 'featured' | 'all'

/**
 * 密度档位。natural 模式下是「每行目标高度」，按容器宽度换算——
 * 用 vw 会在窄容器里失准，用容器宽度才对得上一行放几张。
 */
const DENSITY: Record<Density, { label: string; targetH: (w: number) => number; cell: string }> = {
  loose: { label: '疏', targetH: (w) => clamp(Math.min(220, w * 0.6), w * 0.26, 300), cell: 'clamp(150px, 22vw, 240px)' },
  normal: { label: '中', targetH: (w) => clamp(Math.min(160, w * 0.42), w * 0.17, 215), cell: 'clamp(108px, 14vw, 165px)' },
  dense: { label: '密', targetH: (w) => clamp(Math.min(110, w * 0.28), w * 0.108, 140), cell: 'clamp(76px, 9vw, 110px)' },
}

const GAP = 8

/** 下限优先：窄容器上「一行放几张」由下限决定，宽容器上才轮到按比例的那一档说话。 */
function clamp(min: number, v: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

/**
 * 等高行（justified rows）：贪心地往一行里塞图，塞到总宽超过容器就收行，
 * 收行时反解出这一行的高度 —— (容器宽 - 间距) / 这一行宽高比之和。
 * 于是同一行里每张图高度一致、整行正好铺满，而每张都保持真实比例，一刀不裁。
 *
 * 尾行不拉伸，按目标高度原样停住，`stretched: false`——渲染时据此关掉 flex-grow，
 * 否则浏览器仍会把这几张图在宽度上撑满整行，行高却没跟着放大到匹配的比例，
 * 于是每张图的渲染框宽高比偏离原图，object-cover 只能拿裁切去填这个偏差。
 * 空出来的一角留白，好过每张图都被莫名其妙切一刀。
 *
 * 宽度不写死像素，交给 flex-grow 按宽高比分配（仅限已铺满的行）——
 * 亚像素误差由浏览器吸收，不会出现四舍五入攒出来的一条缝。
 */
function buildRows(photos: GalleryPhoto[], containerW: number, targetH: number) {
  const rows: { photos: GalleryPhoto[]; height: number; stretched: boolean }[] = []
  let line: GalleryPhoto[] = []
  let arSum = 0

  for (const photo of photos) {
    const ar = photo.width / photo.height
    line.push(photo)
    arSum += ar
    const width = arSum * targetH + GAP * (line.length - 1)
    if (width >= containerW) {
      rows.push({ photos: line, height: (containerW - GAP * (line.length - 1)) / arSum, stretched: true })
      line = []
      arSum = 0
    }
  }
  if (line.length > 0) rows.push({ photos: line, height: targetH, stretched: false })
  return rows
}

export function GalleryBoard({
  featuredPhotos,
  allPhotos,
  eraBoundary,
}: {
  featuredPhotos: GalleryPhoto[]
  allPhotos: GalleryPhoto[]
  eraBoundary: number | null
}) {
  const [collection, setCollection] = useState<CollectionMode>('featured')
  const [mode, setMode] = useState<ViewMode>('natural')
  const [density, setDensity] = useState<Density>('normal')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [activeYear, setActiveYear] = useState<string | null>(null)
  const [yearPickerOpen, setYearPickerOpen] = useState(false)
  const boardRef = useRef<HTMLDivElement>(null)
  // dock 滑到图墙末尾就停在那儿，不跟着飘到征集文案和页脚上面
  const boardOuterRef = useRef<HTMLDivElement>(null)
  // 首屏用一个常见桌面宽度排一版，挂载后立刻按真实宽度重排；窗口缩放同样跟着重排。
  const [boardW, setBoardW] = useState(1120)
  const photos = collection === 'featured' ? featuredPhotos : allPhotos

  useEffect(() => {
    const node = boardRef.current
    if (!node) return
    const measure = () => setBoardW(node.getBoundingClientRect().width)
    // 三条路一起上：挂载后量一次（首屏那版是按默认宽度排的），容器变化用 ResizeObserver，
    // 再挂一个 resize 兜底——有些环境（后台标签页、不渲染的画中画）会把 RO 的回调压住不发。
    const raf = requestAnimationFrame(measure)
    const ro = new ResizeObserver(measure)
    ro.observe(node)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return photos
    return photos.filter((p) =>
      `${p.title ?? ''} ${p.caption ?? ''} ${p.date ?? p.year ?? UNDATED_LABEL} ${p.time ?? ''}`.toLowerCase().includes(needle),
    )
  }, [photos, q])

  const sections = useMemo(() => {
    const map = new Map<string, GalleryPhoto[]>()
    for (const p of visible) {
      const key = bucketOf(p)
      const list = map.get(key)
      if (list) list.push(p)
      else map.set(key, [p])
    }
    return [...map.entries()].sort(([a], [b]) => sortBucket(a, b)).map(([y, list]) => ({ year: y, photos: list }))
  }, [visible])

  // 年份谱按全量统计，不跟着筛选变——它是这批素材的固定形状，缩放会让人失去参照。
  const spectrum = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of photos) {
      const key = bucketOf(p)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    const keys = [...map.keys()].sort(sortBucket)
    const max = Math.max(1, ...map.values())
    return keys.map((y) => ({ year: y, count: map.get(y)!, ratio: map.get(y)! / max }))
  }, [photos])

  // 时期色由数据推导出的分界决定，桌面柱状谱和手机选择面板共用一套
  const eraColor = useCallback(
    (y: string) => {
      if (y === UNDATED) return 'var(--era-unknown)'
      return eraBoundary !== null && Number(y) >= eraBoundary ? 'var(--era-live)' : 'var(--era-video)'
    },
    [eraBoundary],
  )

  const jumpToYear = useCallback((y: string) => {
    document.getElementById(`gy-${y}`)?.scrollIntoView({ block: 'start' })
  }, [])

  const openIndex = openId === null ? -1 : visible.findIndex((p) => p.id === openId)

  const step = useCallback(
    (delta: number) => {
      if (openIndex < 0 || visible.length === 0) return
      setOpenId(visible[(openIndex + delta + visible.length) % visible.length].id)
    },
    [openIndex, visible],
  )

  const randomOpen = () => {
    if (visible.length === 0) return
    setOpenId(visible[Math.floor(Math.random() * visible.length)].id)
  }

  // 滚到哪一年，年份谱就点亮哪一年。观察线放在视口上三分之一处，跟阅读位置一致。
  useEffect(() => {
    const nodes = sections.map(({ year: y }) => document.getElementById(`gy-${y}`)).filter(Boolean) as HTMLElement[]
    if (nodes.length === 0) return
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (hit) setActiveYear(hit.target.id.replace('gy-', ''))
      },
      { rootMargin: '-12% 0px -70% 0px', threshold: 0 },
    )
    nodes.forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [sections])

  const filtered = q.trim().length > 0

  const chooseCollection = (next: CollectionMode) => {
    if (next === collection) return
    setCollection(next)
    setQ('')
    setOpenId(null)
    setActiveYear(null)
    setYearPickerOpen(false)
  }

  return (
    <>
      <div className="mb-8 flex flex-col gap-3 border-y border-line/70 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-fit items-center gap-1 rounded-full border border-line/80 bg-surface/50 p-1" role="tablist" aria-label="画廊版本">
          <button
            type="button"
            role="tab"
            aria-selected={collection === 'featured'}
            onClick={() => chooseCollection('featured')}
            className={`ui-press rounded-full px-4 py-2 text-control transition-colors ${
              collection === 'featured' ? 'bg-ink font-medium text-base' : 'text-muted hover:text-ink'
            }`}
          >
            精选 · {featuredPhotos.length}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={collection === 'all'}
            onClick={() => chooseCollection('all')}
            className={`ui-press rounded-full px-4 py-2 text-control transition-colors ${
              collection === 'all' ? 'bg-ink font-medium text-base' : 'text-muted hover:text-ink'
            }`}
          >
            全量 · {allPhotos.length}
          </button>
        </div>
        <p className="text-meta text-faint">
          {collection === 'featured' ? '按时间收拢关键节点与代表画面' : '按年份铺开，每场直播或视频保留一张代表帧'}
        </p>
      </div>

      {/* 年份谱 + 控制区：浮在画面之上的一条可拖拽 dock，默认停在底部。 */}
      <ControlDock stopRef={boardOuterRef} alignRef={boardRef}>
        {/* 底部对齐：dock 里所有东西——柱子的底线、年份标签、按钮——落在同一条线上。
            居中对齐时柱状谱会浮在按钮中间，底线跟谁都对不上，看着就是「差一点」。 */}
        <div className="flex items-end gap-2 sm:gap-3">
          <DragGrip />
          {/* 手机端：横着拨的年份谱在 375px 上只露得出三四年，改成点开的选择面板。 */}
          <YearPicker
            spectrum={spectrum}
            activeYear={activeYear}
            eraColor={eraColor}
            open={yearPickerOpen}
            onOpenChange={setYearPickerOpen}
            onPick={jumpToYear}
          />

          {/* 桌面端：年份谱单独横向滚动，年份再多也不会把控制区挤到下一行。 */}
          <div className="no-scrollbar hidden shrink-0 touch-auto items-end gap-1.5 overflow-x-auto sm:flex sm:gap-2">
          {spectrum.map(({ year: y, count, ratio }) => {
            const isActive = activeYear === y
            const era = eraColor(y)
            return (
              <button
                key={y}
                type="button"
                onClick={() => jumpToYear(y)}
                title={y === UNDATED ? `${UNDATED_LABEL} · ${count} 张` : `${y} 年 · ${count} 张`}
                aria-label={y === UNDATED ? `跳到${UNDATED_LABEL} · ${count} 张` : `跳到 ${y} 年 · ${count} 张`}
                aria-current={isActive ? 'true' : undefined}
                className="group ui-press flex w-[2.375rem] shrink-0 flex-col items-center gap-[3px] rounded-sm"
              >
                {/* 柱高封到 18px：dock 是一条工具条，不是一块图表面板——
                    再高一点，整条 dock 就得跟着长，按钮也会被顶得离底边很远。
                    具体张数交给 title / aria-label，柱高只回答「哪年多」。 */}
                <span
                  className="w-full rounded-[2px] transition-[height,opacity,background-color] duration-500"
                  style={{
                    height: `${4 + ratio * 14}px`,
                    background: era,
                    opacity: isActive ? 1 : 0.3,
                  }}
                />
                <span
                  className="font-mono text-[10px] leading-none tnum transition-colors"
                  style={{ color: isActive ? era : undefined }}
                >
                  <span className={isActive ? '' : 'text-faint group-hover:text-muted'}>{y === UNDATED ? '待定' : y}</span>
                </span>
              </button>
            )
          })}

          </div>

          {/* 控制区固定在右侧，不参与换行；手机端只保留最必要的两个 */}
          <div className="flex shrink-0 items-center gap-2">
            <SearchField
              value={q}
              onChange={setQ}
              placeholder={`搜索日期 · 共 ${photos.length} 张`}
              ariaLabel="搜索画面"
              inputClassName="w-[10rem] rounded-md border border-line bg-surface px-3 py-2 text-control text-ink placeholder:text-faint transition-[border-color,background-color] duration-300 hover:bg-raised/70 focus:border-live focus:bg-raised/70 focus:outline-none sm:w-[13rem]"
            />
            <SegmentedControl
              label="排列"
              value={mode}
              options={[
                { value: 'natural' as const, label: '原貌' },
                { value: 'uniform' as const, label: '整齐' },
              ]}
              onChange={setMode}
            />
            <div className="hidden sm:block">
              <SegmentedControl
                label="密度"
                value={density}
                options={(Object.keys(DENSITY) as Density[]).map((d) => ({ value: d, label: DENSITY[d].label }))}
                onChange={setDensity}
              />
            </div>
            <button
              type="button"
              onClick={randomOpen}
              aria-label="随便翻一张"
              className="ui-press rounded-full border border-line/80 bg-surface/50 px-3 py-2 text-meta text-muted transition-colors hover:border-today/60 hover:text-today"
            >
              <span className="hidden sm:inline">随便翻一张 </span>↯
            </button>
          </div>
        </div>
      </ControlDock>

      {filtered && (
        <p className="mb-6 text-meta text-faint tnum">
          筛出 {visible.length} 张
          <button
            type="button"
            onClick={() => setQ('')}
            className="ml-2 text-live underline underline-offset-4"
          >
            清除
          </button>
        </p>
      )}

      {/* gallery-bleed：手机上让图墙贴近屏幕边缘——13vw 的安全边距是给正文的，
          套在图墙上会把一行挤到只剩两张。底部留出 dock 的高度，否则最后一行永远被浮层压住一截。 */}
      <div ref={boardOuterRef} className="gallery-bleed pb-28" style={{ '--cell-w': DENSITY[density].cell } as React.CSSProperties}>
        <div ref={boardRef}>
        {sections.map(({ year: y, photos: list }) => (
          <section key={y} id={`gy-${y}`} className="mb-16 scroll-mt-28 sm:mb-24">
            <header className="mb-4 flex items-baseline gap-4">
              <h2 className="font-mono text-h2 font-semibold tnum leading-none" style={{ color: eraColor(y) }}>
                {y === UNDATED ? UNDATED_LABEL : y}
              </h2>
              <span className="text-meta text-faint tnum">{list.length} 张</span>
              <span className="h-px flex-1 bg-line/70" />
              {/* 年份没核实出来就没有「这一年」可跳；与其给个假链接，不如说清楚它还缺什么 */}
              {y === UNDATED ? (
                <span className="shrink-0 text-meta text-faint">还没核实出拍摄年份</span>
              ) : (
                <Link href={`/archive/?y=${y}`} className="ui-press shrink-0 rounded-sm text-meta text-faint transition-colors hover:text-live">
                  这一年的编年史 →
                </Link>
              )}
            </header>

            {mode === 'natural' ? (
              <div className="flex flex-col" style={{ gap: GAP }}>
                {buildRows(list, boardW, DENSITY[density].targetH(boardW)).map((row, i) => (
                  <div key={i} className="flex" style={{ gap: GAP, height: row.height }}>
                    {row.photos.map((p) => (
                      <PhotoCell key={p.id} photo={p} rowHeight={row.height} stretched={row.stretched} onOpen={() => setOpenId(p.id)} />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="photo-uniform">
                {list.map((p) => (
                  <PhotoCell key={p.id} photo={p} uniform onOpen={() => setOpenId(p.id)} />
                ))}
              </div>
            )}
          </section>
        ))}
        </div>
      </div>

      {visible.length === 0 && <p className="py-16 text-center text-meta text-faint">没有符合的画面。</p>}

      {openIndex >= 0 &&
        typeof document !== 'undefined' &&
        createPortal(
          <Lightbox photo={visible[openIndex]} index={openIndex} total={visible.length} visible={visible} onClose={() => setOpenId(null)} onStep={step} />,
          document.body,
        )}
    </>
  )
}

type SpectrumEntry = { year: string; count: number; ratio: number }

/**
 * 手机端的年份选择：dock 里只留一枚显示当前年份的按钮，点开才铺出全部年份。
 *
 * 横着拨的柱状谱在 375px 宽上只露得出三四年，剩下的要靠盲滑找——
 * 一个知道自己在哪、点一下就能挑的面板比它可用得多。面板里保留柱子（等比长度）
 * 和张数，「哪年多」这个信息不因为换了形态就丢掉。
 */
function YearPicker({
  spectrum,
  activeYear,
  eraColor,
  open,
  onOpenChange,
  onPick,
}: {
  spectrum: SpectrumEntry[]
  activeYear: string | null
  eraColor: (year: string) => string
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (year: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const current = activeYear ?? spectrum[0]?.year ?? ''

  useEffect(() => {
    if (!open) return
    const onDocPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onOpenChange(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])

  if (spectrum.length === 0) return null

  return (
    <div ref={ref} data-no-drag className="relative shrink-0 sm:hidden">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="ui-press flex items-center gap-1.5 rounded-full border border-line/80 bg-surface/50 px-3 py-2 font-mono text-meta tnum transition-colors"
        style={{ color: eraColor(current) }}
      >
        {current}
        <span className="text-faint">▾</span>
      </button>

      {open && (
        // dock 停在视口底部，面板只能往上开
        <div
          role="menu"
          className="absolute bottom-full left-0 z-10 mb-2 w-[13.5rem] rounded-xl border border-line bg-surface/95 p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-md"
        >
          {spectrum.map(({ year, count, ratio }) => {
            const isActive = year === activeYear
            return (
              <button
                key={year}
                type="button"
                role="menuitem"
                onClick={() => {
                  onPick(year)
                  onOpenChange(false)
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                  isActive ? 'bg-raised' : 'hover:bg-raised/60'
                }`}
              >
                <span className="font-mono text-meta tnum" style={{ color: isActive ? eraColor(year) : undefined }}>
                  <span className={isActive ? '' : 'text-muted'}>{year}</span>
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line/70">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${Math.max(6, ratio * 100)}%`, background: eraColor(year), opacity: isActive ? 1 : 0.5 }}
                  />
                </span>
                <span className="w-10 shrink-0 text-right font-mono text-meta tnum text-faint">{count} 张</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const DOCK_POS_KEY = 'gallery-dock-pos'
const DOCK_MARGIN = 12
/** dock 贴视口底边（以及停靠时贴图墙底边）的距离 */
const DOCK_BOTTOM = 20

/**
 * 控制区 dock：浮在内容之上，可以拖到任何位置，默认停在视口底部居中。
 *
 * 放底部而不是顶部：翻图时视线在画面上，工具停在下缘更像是「手边的东西」，
 * 顶部吸顶条则会一直在读图的正上方切一刀。
 *
 * 底色只压到刚好能和图分开——再厚就变成一块挡板，画廊的主角是图不是控件。
 * 位置写进 localStorage，拖到顺手的地方下次还在那儿。
 */
const subscribeNoop = () => () => {}

function ControlDock({
  children,
  stopRef,
  alignRef,
}: {
  children: React.ReactNode
  /** 停靠边界：滚过它的底边，dock 就钉在那儿不再跟着视口 */
  stopRef: React.RefObject<HTMLElement | null>
  /** 左对齐基准：图墙的内容区（不含手机端的贴边内边距） */
  alignRef: React.RefObject<HTMLElement | null>
}) {
  // dock 必须挂到 body 上：页面容器带入场 transform，会成为 fixed 的包含块，
  // 留在原地的话「浮在视口底部」会变成「浮在文档某个位置」，滚两屏就不见了。
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  // 停靠位置（文档坐标）。null = 还在跟着视口底边走。
  const [parkedTop, setParkedTop] = useState<number | null>(null)
  // 默认横向位置：对齐图墙左边缘。null = 还没量到，先居中兜底。
  const [defaultLeft, setDefaultLeft] = useState<number | null>(null)
  const offset = useRef<{ dx: number; dy: number } | null>(null)

  const clampToViewport = useCallback((x: number, y: number) => {
    const rect = ref.current?.getBoundingClientRect()
    const w = rect?.width ?? 0
    const h = rect?.height ?? 0
    return {
      x: Math.min(Math.max(DOCK_MARGIN, x), Math.max(DOCK_MARGIN, window.innerWidth - w - DOCK_MARGIN)),
      y: Math.min(Math.max(DOCK_MARGIN, y), Math.max(DOCK_MARGIN, window.innerHeight - h - DOCK_MARGIN)),
    }
  }, [])

  // 读取上次拖到的位置。放在 effect 里而不是初始 state：服务端没有 localStorage，
  // 直接读会让首屏 HTML 和客户端对不上。
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DOCK_POS_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as { x: number; y: number }
        // 从 localStorage 恢复位置只能在挂载后做：服务端没有 localStorage，
        // 放进 useState 初值会让首屏 HTML 和客户端渲染对不上。
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) setPos(clampToViewport(parsed.x, parsed.y))
      }
    } catch {
      // localStorage 不可用（隐私模式等）就用默认位置，不值得为此报错
    }
  }, [clampToViewport])

  /**
   * 图墙看完了，dock 就该停下。
   *
   * 一直钉在视口底边，往下翻到征集文案和页脚时它还浮在那儿——那些地方没有一张图，
   * 一条挑年份、调密度的工具条待在上面纯属挡路。所以滚到图墙末尾时把它从 fixed
   * 换成 absolute，钉在图墙底边（图墙本来就为它留了 pb-28 的位置）；往回滚、
   * 图墙底边重新落到 dock 下面时再交还给视口。
   *
   * 判据就是比大小：视口底边那条线要是已经越过图墙底边，就停靠。
   * 手动拖过的位置不参与——那是人自己挑的地方，不该被这套规则改掉。
   */
  useEffect(() => {
    // 拖过之后位置由人说了算，这套规则整个让开（placement 里 pos 优先，残留值不影响）
    if (pos) return
    const update = () => {
      const node = ref.current
      const stop = stopRef.current
      if (!node || !stop) return
      const height = node.offsetHeight
      const stopRect = stop.getBoundingClientRect()
      const stopBottomDoc = stopRect.bottom + window.scrollY
      const parked = stopBottomDoc - DOCK_BOTTOM - height
      const followingViewport = window.scrollY + window.innerHeight - DOCK_BOTTOM - height
      setParkedTop(followingViewport > parked ? parked : null)
      // 左对齐图墙：正中间是「没想好放哪」的位置，跟版面上任何一条边都对不上。
      // dock 比图墙还宽时（窄屏）往回收，别顶出右边缘。
      const maxLeft = Math.max(DOCK_MARGIN, window.innerWidth - node.offsetWidth - DOCK_MARGIN)
      const alignLeft = alignRef.current?.getBoundingClientRect().left ?? stopRect.left
      setDefaultLeft(Math.min(Math.max(DOCK_MARGIN, alignLeft), maxLeft))
    }
    const raf = requestAnimationFrame(update)
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [pos, stopRef, alignRef])

  // 窗口变小后不能让 dock 留在视口外面
  useEffect(() => {
    if (!pos) return
    const onResize = () => setPos((p) => (p ? clampToViewport(p.x, p.y) : p))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [pos, clampToViewport])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    // 除了控件本身，dock 上任何地方都能拖：一个几像素的小握把是设计上的偷懒。
    // 反过来，落在按钮 / 输入框 / 可横滚的年份谱上就一定不是拖动——
    // 那是点按钮、选文字、拨年份，抢了手势等于把控件废掉。
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea, [data-no-drag]')) return
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    offset.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top }
    setPos({ x: rect.left, y: rect.top })
    setDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !offset.current) return
    setPos(clampToViewport(e.clientX - offset.current.dx, e.clientY - offset.current.dy))
  }

  const endDrag = (e: React.PointerEvent) => {
    if (!dragging) return
    setDragging(false)
    offset.current = null
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
    if (pos) {
      try {
        window.localStorage.setItem(DOCK_POS_KEY, JSON.stringify(pos))
      } catch {
        // 存不下就算了，位置只是便利，不是数据
      }
    }
  }

  // 拖到犄角旮旯之后要能一键收回来：双击握把恢复默认的底部居中。
  const resetPos = () => {
    setPos(null)
    try {
      window.localStorage.removeItem(DOCK_POS_KEY)
    } catch {
      // 同上，存储不可用不影响功能
    }
  }

  // 还没量到图墙位置的那一帧先居中兜底，量到之后一律左对齐
  const horizontal: React.CSSProperties =
    defaultLeft !== null ? { left: defaultLeft } : { left: '50%', transform: 'translateX(-50%)' }

  const placement: React.CSSProperties = pos
    ? { position: 'fixed', left: pos.x, top: pos.y }
    : parkedTop !== null
      ? { position: 'absolute', top: parkedTop, ...horizontal }
      : { position: 'fixed', bottom: DOCK_BOTTOM, ...horizontal }

  if (!mounted) return null

  return createPortal(
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={(e) => {
        if (!(e.target as HTMLElement).closest('button, a, input, select, textarea, [data-no-drag]')) resetPos()
      }}
      className={`z-40 max-w-[calc(100vw-1.5rem)] touch-none select-none rounded-2xl border border-white/[0.07] bg-base/35 px-2 py-2 shadow-[0_16px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-2.5 ${
        dragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      style={placement}
    >
      {children}
    </div>,
    document.body,
  )
}

/** 拖动提示：整条 dock 都能拖，这几个点只是告诉人「这东西可以挪」。 */
function DragGrip() {
  return (
    <span
      aria-hidden
      title="拖动 · 双击回到默认位置"
      className="mb-2.5 flex shrink-0 flex-col gap-[3px] px-1 opacity-35"
    >
      {[0, 1, 2].map((i) => (
        <span key={i} className="flex gap-[3px]">
          <span className="h-[3px] w-[3px] rounded-full bg-ink" />
          <span className="h-[3px] w-[3px] rounded-full bg-ink" />
        </span>
      ))}
    </span>
  )
}

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-line/80 bg-surface/50 p-0.5" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`ui-press rounded-full px-2.5 py-1.5 text-meta transition-colors ${
            value === o.value ? 'bg-raised text-ink' : 'text-faint hover:text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** 没有确认过的标题就不编一个，只说这是哪一天（或者还没定年份）的画面。 */
function photoAlt(photo: GalleryPhoto) {
  if (photo.title) return photo.title
  return photo.date ? `${photo.date} 的画面` : '年份待定的画面'
}

function PhotoCell({
  photo,
  uniform = false,
  rowHeight,
  stretched = true,
  onOpen,
}: {
  photo: GalleryPhoto
  uniform?: boolean
  /** natural 模式下这一行的高度；未铺满的行据此算出每张图自己的真实宽度，不交给 flex-grow 撑。 */
  rowHeight?: number
  /** 这一行是否铺满了容器宽度。false 时关掉 flex-grow——见 buildRows 顶部注释。 */
  stretched?: boolean
  onOpen: () => void
}) {
  const ar = photo.width / photo.height
  const naturalStyle: React.CSSProperties | undefined = uniform
    ? undefined
    : stretched
      ? { flex: `${ar} 1 0` }
      // 未铺满的行：宽度按真实宽高比 × 行高算死，不参与 flex-grow 分配剩余空间，
      // 行末留白，好过把这几张图硬撑满整行宽度、挤出裁切。
      : { flex: '0 0 auto', width: rowHeight ? rowHeight * ar : undefined }
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`打开大图：${photoAlt(photo)}`}
      className="group relative block h-full min-w-0 overflow-hidden rounded-[3px] bg-raised outline-none"
      style={naturalStyle}
    >
      <span className={`block h-full ${uniform ? 'aspect-square' : ''}`}>
        {/* 列表一律用 thumb：一屏几十张，用大图等于把带宽烧在 200px 高的格子上 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.thumb}
          alt={photoAlt(photo)}
          loading="lazy"
          decoding="async"
          width={photo.width}
          height={photo.height}
          className="block h-full w-full object-cover transition-[transform,filter] duration-500 ease-[var(--ease-out-expo)] group-hover:scale-[1.03] group-hover:brightness-110"
        />
      </span>
      {/* 平时是纯图，hover / 聚焦才浮出时间戳——一屏几十张时，常驻文字才是疲劳的来源。 */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-2 pb-1.5 pt-8 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className="truncate font-mono text-meta tnum text-white/90">{photo.date ?? photo.year ?? UNDATED_LABEL}</span>
        {photo.time && <span className="shrink-0 font-mono text-meta tnum text-white/55">{photo.time}</span>}
      </span>
    </button>
  )
}

function Lightbox({
  photo,
  index,
  total,
  visible,
  onClose,
  onStep,
}: {
  photo: GalleryPhoto
  index: number
  total: number
  /** 当前可见的完整列表，只用来预取左右邻居的大图，不参与渲染。 */
  visible: GalleryPhoto[]
  onClose: () => void
  onStep: (delta: number) => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const sourceHref = photo.source ? gallerySourceHref(photo.source) : null

  // 预取左右各两张的大图：切换时如果还要等网络请求，方向键连按会明显卡顿。
  // 提前把邻居的大图丢进浏览器缓存，onStep 换下一张时基本是本地命中。
  useEffect(() => {
    if (visible.length === 0) return
    const neighbors = [-2, -1, 1, 2].map((delta) => visible[(index + delta + visible.length) % visible.length])
    const images = neighbors.map((p) => {
      const img = new Image()
      img.src = p.src
      return img
    })
    return () => {
      // 卸载不该继续吃带宽——把 src 清掉，浏览器会中止还没完成的请求。
      images.forEach((img) => {
        img.src = ''
      })
    }
  }, [index, visible])

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null
    const prevScrollY = window.scrollY
    const prevOverflow = document.body.style.overflow
    const prevBehavior = document.documentElement.style.scrollBehavior
    document.documentElement.style.scrollBehavior = 'auto'
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') onStep(-1)
      else if (e.key === 'ArrowRight') onStep(1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      document.documentElement.style.scrollBehavior = prevBehavior
      prevFocus?.focus({ preventScroll: true })
      window.scrollTo(0, prevScrollY)
    }
  }, [onClose, onStep])

  return (
    <div className="fixed inset-0 z-50 flex flex-col" role="dialog" aria-modal="true" aria-label={photoAlt(photo)}>
      <button aria-label="关闭" onClick={onClose} className="absolute inset-0 bg-base/94 backdrop-blur-md" />

      {/* 大图独占版面，说明只留一条底栏——竖图在侧栏式灯箱里会被挤得很小。
          点击图片本身以外的任何地方都要能关闭，不能只靠 Esc：这一整块本来看着像空白背景，
          但它是不透明的 div，盖在最外层那个全屏关闭按钮上面，点了没反应。
          用 target === currentTarget 判断「点的是这层本身，不是里面的图或按钮」。 */}
      <div
        className="ui-backdrop-in relative flex min-h-0 flex-1 items-center justify-center p-4 sm:p-10"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        {/* 灯箱才去取大图。先把 thumb 放在同一位置当占位，大图到位前不会是一块空白。 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.src}
          alt={photoAlt(photo)}
          style={{ backgroundImage: `url(${photo.thumb})`, backgroundSize: 'cover' }}
          className="max-h-full max-w-full rounded-sm object-contain shadow-[0_40px_120px_rgba(0,0,0,0.7)]"
        />
        <button
          onClick={() => onStep(-1)}
          aria-label="上一张"
          className="ui-press absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-line/60 bg-surface/70 px-3 py-4 text-muted backdrop-blur transition-colors hover:text-ink sm:left-6"
        >
          ←
        </button>
        <button
          onClick={() => onStep(1)}
          aria-label="下一张"
          className="ui-press absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-line/60 bg-surface/70 px-3 py-4 text-muted backdrop-blur transition-colors hover:text-ink sm:right-6"
        >
          →
        </button>
      </div>

      <div className="relative border-t border-line/60 bg-surface/85 px-4 py-3 backdrop-blur sm:px-10 sm:py-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="font-mono text-meta uppercase tracking-[0.16em] text-today">{photo.year ?? UNDATED_LABEL}</span>
          {photo.date && (
            <span className="font-mono text-meta tnum text-muted">
              {photo.date}
              {photo.time ? ` · ${photo.time}` : ''}
            </span>
          )}
          <span className="font-mono text-meta tnum text-faint">
            {photo.width} × {photo.height}
          </span>
          <span className="ml-auto font-mono text-meta tnum text-faint">
            {index + 1} / {total}
          </span>
          <button ref={closeRef} onClick={onClose} className="ui-press rounded-sm px-2 py-1 text-meta text-muted transition-colors hover:text-ink">
            关闭 · Esc
          </button>
        </div>

        <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
          {photo.title ? <h3 className="text-body font-medium text-ink">{photo.title}</h3> : <span className="text-meta text-faint">标题待命名</span>}
          {photo.caption && <p className="max-w-3xl text-meta leading-relaxed text-muted">{photo.caption}</p>}
          {photo.source &&
            (sourceHref ? (
              <a
                href={sourceHref}
                target="_blank"
                rel="noreferrer"
                className="ui-press shrink-0 text-meta text-live underline decoration-live/40 underline-offset-4 hover:text-ink"
              >
                查看来源 ↗
              </a>
            ) : (
              <span className="shrink-0 font-mono text-meta text-faint">{photo.source}</span>
            ))}
        </div>
      </div>
    </div>
  )
}
