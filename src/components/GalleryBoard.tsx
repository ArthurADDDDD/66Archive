'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import type { GalleryPhoto } from '@/lib/gallery-preview'
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
 * 尾行不拉伸，按目标高度停住：几张图被撑成一整排巨图比留白难看得多。
 *
 * 宽度不写死像素，交给 flex-grow 按宽高比分配 —— 亚像素误差由浏览器吸收，
 * 不会出现四舍五入攒出来的一条缝。
 */
function buildRows(photos: GalleryPhoto[], containerW: number, targetH: number) {
  const rows: { photos: GalleryPhoto[]; height: number }[] = []
  let line: GalleryPhoto[] = []
  let arSum = 0

  for (const photo of photos) {
    const ar = photo.width / photo.height
    line.push(photo)
    arSum += ar
    const width = arSum * targetH + GAP * (line.length - 1)
    if (width >= containerW) {
      rows.push({ photos: line, height: (containerW - GAP * (line.length - 1)) / arSum })
      line = []
      arSum = 0
    }
  }
  if (line.length > 0) rows.push({ photos: line, height: targetH })
  return rows
}

export function GalleryBoard({ photos, eraBoundary }: { photos: GalleryPhoto[]; eraBoundary: number | null }) {
  const [mode, setMode] = useState<ViewMode>('natural')
  const [density, setDensity] = useState<Density>('normal')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [activeYear, setActiveYear] = useState<string | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  // 首屏用一个常见桌面宽度排一版，挂载后立刻按真实宽度重排；窗口缩放同样跟着重排。
  const [boardW, setBoardW] = useState(1120)

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
    return photos.filter((p) => `${p.title ?? ''} ${p.date ?? p.year} ${p.time ?? ''}`.toLowerCase().includes(needle))
  }, [photos, q])

  const sections = useMemo(() => {
    const map = new Map<string, GalleryPhoto[]>()
    for (const p of visible) {
      const bucket = map.get(p.year)
      if (bucket) bucket.push(p)
      else map.set(p.year, [p])
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([y, list]) => ({ year: y, photos: list }))
  }, [visible])

  // 年份谱按全量统计，不跟着筛选变——它是这批素材的固定形状，缩放会让人失去参照。
  const spectrum = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of photos) map.set(p.year, (map.get(p.year) ?? 0) + 1)
    const years = [...map.keys()].sort()
    const max = Math.max(1, ...map.values())
    return years.map((y) => ({ year: y, count: map.get(y)!, ratio: map.get(y)! / max }))
  }, [photos])

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

  return (
    <>
      {/* 年份谱 + 控制区：浮在画面之上的一条可拖拽 dock，默认停在底部。 */}
      <ControlDock>
        <div className="flex items-end gap-2 sm:gap-3">
          <DragGrip />
          {/* 年份谱单独横向滚动：年份多起来也不会把控制区挤到下一行、把吸顶条撑成一堵墙。 */}
          <div className="no-scrollbar flex shrink-0 items-end gap-1.5 overflow-x-auto max-sm:min-w-0 max-sm:max-w-[45vw] max-sm:shrink sm:gap-2.5">
          {spectrum.map(({ year: y, count, ratio }) => {
            const isActive = activeYear === y
            const era = eraBoundary !== null && Number(y) >= eraBoundary ? 'var(--era-live)' : 'var(--era-video)'
            return (
              <button
                key={y}
                type="button"
                onClick={() => document.getElementById(`gy-${y}`)?.scrollIntoView({ block: 'start' })}
                aria-label={`跳到 ${y} 年 · ${count} 张`}
                aria-current={isActive ? 'true' : undefined}
                className="group ui-press flex shrink-0 flex-col items-center gap-1 rounded-sm px-1"
              >
                {/* 张数只在桌面常驻：手机上这一行会把吸顶条又撑高一截，柱高已经说明了多少。 */}
                <span className="hidden font-mono text-meta tnum text-faint transition-colors group-hover:text-ink sm:block" style={isActive ? { color: era } : undefined}>
                  {count}
                </span>
                <span
                  className="w-7 rounded-[2px] transition-[height,opacity,background-color] duration-500 sm:w-9"
                  style={{
                    height: `${6 + ratio * 22}px`,
                    background: era,
                    opacity: isActive ? 1 : 0.28,
                  }}
                />
                <span
                  className="font-mono text-meta tnum transition-colors"
                  style={{ color: isActive ? era : undefined }}
                >
                  <span className={isActive ? '' : 'text-faint group-hover:text-muted'}>{y.slice(2)}</span>
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
      <div className="gallery-bleed pb-28" style={{ '--cell-w': DENSITY[density].cell } as React.CSSProperties}>
        <div ref={boardRef}>
        {sections.map(({ year: y, photos: list }) => (
          <section key={y} id={`gy-${y}`} className="mb-16 scroll-mt-28 sm:mb-24">
            <header className="mb-4 flex items-baseline gap-4">
              <h2
                className="font-mono text-h2 font-semibold tnum leading-none"
                style={{ color: eraBoundary !== null && Number(y) >= eraBoundary ? 'var(--era-live)' : 'var(--era-video)' }}
              >
                {y}
              </h2>
              <span className="text-meta text-faint tnum">{list.length} 张</span>
              <span className="h-px flex-1 bg-line/70" />
              <Link href={`/archive/?y=${y}`} className="ui-press shrink-0 rounded-sm text-meta text-faint transition-colors hover:text-live">
                这一年的编年史 →
              </Link>
            </header>

            {mode === 'natural' ? (
              <div className="flex flex-col" style={{ gap: GAP }}>
                {buildRows(list, boardW, DENSITY[density].targetH(boardW)).map((row, i) => (
                  <div key={i} className="flex" style={{ gap: GAP, height: row.height }}>
                    {row.photos.map((p) => (
                      <PhotoCell key={p.id} photo={p} onOpen={() => setOpenId(p.id)} />
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
          <Lightbox photo={visible[openIndex]} index={openIndex} total={visible.length} onClose={() => setOpenId(null)} onStep={step} />,
          document.body,
        )}
    </>
  )
}

const DOCK_POS_KEY = 'gallery-dock-pos'
const DOCK_MARGIN = 12

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

function ControlDock({ children }: { children: React.ReactNode }) {
  // dock 必须挂到 body 上：页面容器带入场 transform，会成为 fixed 的包含块，
  // 留在原地的话「浮在视口底部」会变成「浮在文档某个位置」，滚两屏就不见了。
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
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

  // 窗口变小后不能让 dock 留在视口外面
  useEffect(() => {
    if (!pos) return
    const onResize = () => setPos((p) => (p ? clampToViewport(p.x, p.y) : p))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [pos, clampToViewport])

  const onPointerDown = (e: React.PointerEvent) => {
    // 只从握把拖：否则在搜索框里选文字、在分段控件上滑动都会变成拖动整条 dock。
    if (!(e.target as HTMLElement).closest('[data-dock-grip]')) return
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

  const placement: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y }
    : { left: '50%', bottom: 20, transform: 'translateX(-50%)' }

  if (!mounted) return null

  return createPortal(
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-dock-grip]')) resetPos()
      }}
      className={`fixed z-40 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-white/[0.07] bg-base/35 px-2.5 py-2 shadow-[0_16px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-3.5 sm:py-2.5 ${
        dragging ? 'cursor-grabbing select-none' : ''
      }`}
      style={placement}
    >
      {children}
    </div>,
    document.body,
  )
}

/** 拖动握把：dock 只认这一块，避免和里面的控件抢手势。 */
function DragGrip() {
  return (
    <span
      data-dock-grip
      aria-hidden
      title="拖动 · 双击回到默认位置"
      className="mb-1 flex shrink-0 cursor-grab touch-none flex-col gap-[3px] px-1 py-2 opacity-40 transition-opacity hover:opacity-80 active:cursor-grabbing"
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

function PhotoCell({ photo, uniform = false, onOpen }: { photo: GalleryPhoto; uniform?: boolean; onOpen: () => void }) {
  const ar = photo.width / photo.height
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`打开大图：${photo.title ?? photo.date ?? photo.year}`}
      className="group relative block h-full min-w-0 overflow-hidden rounded-[3px] bg-raised outline-none"
      style={uniform ? undefined : { flex: `${ar} 1 0` }}
    >
      <span className={`block h-full ${uniform ? 'aspect-square' : ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.src}
          alt={photo.title ?? `${photo.date ?? photo.year} 的画面`}
          loading="lazy"
          decoding="async"
          width={photo.width}
          height={photo.height}
          className="block h-full w-full object-cover transition-[transform,filter] duration-500 ease-[var(--ease-out-expo)] group-hover:scale-[1.03] group-hover:brightness-110"
        />
      </span>
      {/* 平时是纯图，hover / 聚焦才浮出时间戳——一屏几十张时，常驻文字才是疲劳的来源。 */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-2 pb-1.5 pt-8 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className="truncate font-mono text-meta tnum text-white/90">{photo.date ?? photo.year}</span>
        {photo.time && <span className="shrink-0 font-mono text-meta tnum text-white/55">{photo.time}</span>}
      </span>
    </button>
  )
}

function Lightbox({
  photo,
  index,
  total,
  onClose,
  onStep,
}: {
  photo: GalleryPhoto
  index: number
  total: number
  onClose: () => void
  onStep: (delta: number) => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)

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
    <div className="fixed inset-0 z-50 flex flex-col" role="dialog" aria-modal="true" aria-label={photo.title ?? `${photo.date ?? photo.year} 的画面`}>
      <button aria-label="关闭" onClick={onClose} className="absolute inset-0 bg-base/94 backdrop-blur-md" />

      {/* 大图独占版面，说明只留一条底栏——竖图在侧栏式灯箱里会被挤得很小。 */}
      <div className="ui-backdrop-in relative flex min-h-0 flex-1 items-center justify-center p-4 sm:p-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.src}
          alt={photo.title ?? `${photo.date ?? photo.year} 的画面`}
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

      <div className="relative flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line/60 bg-surface/80 px-4 py-3 backdrop-blur sm:px-10">
        <span className="font-mono text-meta uppercase tracking-[0.16em] text-today">{photo.year}</span>
        <span className="font-mono text-meta tnum text-muted">
          {photo.date ?? '日期待定'}
          {photo.time ? ` · ${photo.time}` : ''}
        </span>
        <span className="font-mono text-meta tnum text-faint">
          {photo.width} × {photo.height}
        </span>
        {photo.title ? (
          <span className="text-body text-ink">{photo.title}</span>
        ) : (
          <span className="text-meta text-faint">标题待命名</span>
        )}
        <span className="ml-auto font-mono text-meta tnum text-faint">
          {index + 1} / {total}
        </span>
        <button ref={closeRef} onClick={onClose} className="ui-press rounded-sm px-2 py-1 text-meta text-muted transition-colors hover:text-ink">
          关闭 · Esc
        </button>
      </div>
    </div>
  )
}
