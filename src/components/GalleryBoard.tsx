'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { bucketOf, sortBucket, UNDATED, UNDATED_LABEL, type GalleryPhoto } from '@/lib/gallery-photos'
import { gallerySourceHref } from '@/lib/gallery-href'
import { yearColor } from '@/lib/ui'
import { SearchField } from './SearchField'
import { TimelineRail, type TimelineRailMark } from './TimelineRail'

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
 * 纪念版分类说明先不露出：分类名本身已经写在筛选按钮上，
 * 一整块解释文字挡在图墙前面，读者还没看到图就先读了一屏说明。
 * 数组保留——筛选按钮的顺序与文案还靠它。
 */
const SHOW_CATEGORY_GUIDE = false

const FEATURED_CATEGORY_GUIDE = [
  {
    name: '直播时期',
    description: '从不露脸、手部机位、“无头骑士”、屏风时代到“女流之背”，也记录皮套、双机位等形态变化与直播间场景的更替。',
  },
  {
    name: '周年与生日',
    description: '沿着周年、生日和新年等固定时间节点，留下直播生涯的阶段性纪念。',
  },
  {
    name: '大周宇宙',
    description: '记录壮壮、豆豆、YJJ、小涡等成员首次、末次或具有特殊意义的入镜与同框。',
  },
  {
    name: '线下活动',
    description: '收录盛典、嘉年华、校园分享和其他离开直播间后发生的重要现场。',
  },
] as const

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
}: {
  featuredPhotos: GalleryPhoto[]
  allPhotos: GalleryPhoto[]
}) {
  const [collection, setCollection] = useState<CollectionMode>('featured')
  const [mode, setMode] = useState<ViewMode>('natural')
  const [density, setDensity] = useState<Density>('normal')
  const [tag, setTag] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  // 首屏用一个常见桌面宽度排一版，挂载后立刻按真实宽度重排；窗口缩放同样跟着重排。
  const [boardW, setBoardW] = useState(1120)
  const photos = collection === 'featured' ? featuredPhotos : allPhotos

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const photo of featuredPhotos) {
      for (const value of photo.tags ?? []) counts.set(value, (counts.get(value) ?? 0) + 1)
    }
    return counts
  }, [featuredPhotos])

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
    const tagged = tag ? photos.filter((photo) => photo.tags?.includes(tag)) : photos
    const needle = q.trim().toLowerCase()
    if (!needle) return tagged
    return tagged.filter((p) =>
      `${p.title ?? ''} ${p.caption ?? ''} ${(p.tags ?? []).join(' ')} ${p.date ?? p.year ?? UNDATED_LABEL} ${p.time ?? ''}`.toLowerCase().includes(needle),
    )
  }, [photos, q, tag])

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

  // 每年挑第一张作为轨道预览图。预览要的是「这一年长什么样」，不是缩略图墙。
  const yearCovers = useMemo(() => {
    const map = new Map<string, GalleryPhoto>()
    for (const p of photos) {
      const key = bucketOf(p)
      if (!map.has(key)) map.set(key, p)
    }
    return map
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

  const filtered = q.trim().length > 0 || tag !== null

  const chooseCollection = (next: CollectionMode) => {
    if (next === collection) return
    setCollection(next)
    setTag(null)
    setQ('')
    setOpenId(null)
  }

  return (
    <>
      <div className="mb-4 flex border-y border-line/70 py-4">
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
            纪念版 · {featuredPhotos.length}
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
            全量版 · {allPhotos.length}
          </button>
        </div>

        {/* 控件回到文档流：原先它们住在一条可拖拽的浮层里，挡图、抢手势，
            还要记住自己被拖到哪儿。手机端不给这一排——小屏上翻图就够了。 */}
        <div className="ml-auto hidden shrink-0 items-center gap-2 sm:flex">
          <SearchField
            value={q}
            onChange={setQ}
            placeholder={`搜索标题、日期或备注 · 共 ${photos.length} 张`}
            ariaLabel="搜索画面"
            inputClassName="w-[13rem] rounded-md border border-line bg-surface px-3 py-2 text-control text-ink placeholder:text-faint transition-[border-color,background-color] duration-300 hover:bg-raised/70 focus:border-live focus:bg-raised/70 focus:outline-none lg:w-[16rem]"
          />
          {collection === 'all' && (
            <>
              <SegmentedControl
                label="排列"
                value={mode}
                options={[
                  { value: 'natural' as const, label: '原貌' },
                  { value: 'uniform' as const, label: '整齐' },
                ]}
                onChange={setMode}
              />
              <div className="hidden lg:block">
                <SegmentedControl
                  label="密度"
                  value={density}
                  options={(Object.keys(DENSITY) as Density[]).map((d) => ({ value: d, label: DENSITY[d].label }))}
                  onChange={setDensity}
                />
              </div>
            </>
          )}
          <button
            type="button"
            onClick={randomOpen}
            className="ui-press shrink-0 rounded-full border border-line/80 bg-surface/50 px-3 py-2 text-meta text-muted transition-colors hover:border-today/60 hover:text-today"
          >
            随便翻一张 ↯
          </button>
        </div>
      </div>

      {collection === 'featured' && (
        <>
          <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="按纪念版分类筛选">
            <button
              type="button"
              onClick={() => setTag(null)}
              aria-pressed={tag === null}
              className={`ui-press shrink-0 rounded-full border px-3.5 py-2 text-control transition-colors ${
                tag === null ? 'border-today/70 bg-today/10 text-today' : 'border-line/80 text-muted hover:text-ink'
              }`}
            >
              全部 · {featuredPhotos.length}
            </button>
            {FEATURED_CATEGORY_GUIDE.map((item) => {
              const count = tagCounts.get(item.name) ?? 0
              if (count === 0) return null
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setTag(item.name)}
                  aria-pressed={tag === item.name}
                  className={`ui-press shrink-0 rounded-full border px-3.5 py-2 text-control transition-colors ${
                    tag === item.name ? 'border-today/70 bg-today/10 text-today' : 'border-line/80 text-muted hover:text-ink'
                  }`}
                >
                  {item.name} · {count}
                </button>
              )
            })}
          </div>

          {SHOW_CATEGORY_GUIDE && (
          <section className="mb-10 rounded-2xl border border-line/70 bg-surface/35 p-5 sm:mb-14 sm:p-7" aria-label="纪念版分类说明">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
              <div>
                <p className="font-mono text-meta uppercase tracking-[0.16em] text-today">Memorial · 纪念版</p>
                <p className="mt-3 max-w-2xl text-control leading-relaxed text-muted">
                  每张图都经过人工筛选与修订。这里记录的不只是“出现过”，还包括露脸方式、机位与直播间场景的变化，
                  每一次搬家，以及重要成员第一次、最后一次或最有意义的入镜。
                </p>
              </div>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {FEATURED_CATEGORY_GUIDE.map((item) => (
                  <div key={item.name}>
                    <dt className="text-control font-medium text-ink">{item.name}</dt>
                    <dd className="mt-1 text-meta leading-relaxed text-faint">{item.description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
          )}
        </>
      )}

      {/* 年份轨：和站内其他页面一样的右侧时间轴。悬停出预览，点了跳年份。 */}
      <GalleryYearRail spectrum={spectrum} coverOf={yearCovers} />

      {filtered && (
        <p className="mb-6 text-meta text-faint tnum">
          筛出 {visible.length} 张
          <button
            type="button"
            onClick={() => {
              setQ('')
              setTag(null)
            }}
            className="ml-2 text-live underline underline-offset-4"
          >
            清除
          </button>
        </p>
      )}

      {/* 图墙沿用全站 px-page 的左右安全边距，再给右侧年份轨让出一条：
          轨道的悬停区有 5–7rem 宽，不让路的话最右一列图会被它盖住，点不动。 */}
      <div className="pb-16 sm:pb-28 md:pr-[5.5rem] xl:pr-[7rem]" style={{ '--cell-w': DENSITY[density].cell } as React.CSSProperties}>
        <div ref={boardRef}>
        {sections.map(({ year: y, photos: list }) => (
          <section key={y} id={`gy-${y}`} className="mb-16 scroll-mt-28 sm:mb-24">
            <header className="mb-4 flex items-baseline gap-4">
              <h2 className="font-mono text-h2 font-semibold tnum leading-none" style={{ color: yearColor(y === UNDATED ? null : y) }}>
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

            {/* 纪念版：不写 items-start——让同一行的卡片对齐到同一高度，
                将来真有条目多出一行文字，也是整行一起长，不会只戳出一张。 */}
            {collection === 'featured' ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
                {list.map((p) => (
                  <FeaturedPhotoCard key={p.id} photo={p} onOpen={() => setOpenId(p.id)} />
                ))}
              </div>
            ) : mode === 'natural' ? (
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
 * 画廊的年份轨：把年份桶翻译成共用 TimelineRail 的刻度，本身不画任何东西。
 *
 * 它替掉的是画廊自己那条可拖拽的浮动跳转条——那条要自己记住被拖到哪儿、
 * 挡图又抢手势，还和站内其他页面的导航长得不一样。预览图用当年的第一张。
 *
 * 平板宽度就出现（md 起），并给右下角的回到顶部按钮让出底部一层；
 * 手机端不出现——小屏上它会压在图上，而且那儿也没有 hover 可用。
 */
function GalleryYearRail({
  spectrum,
  coverOf,
}: {
  spectrum: SpectrumEntry[]
  coverOf: Map<string, GalleryPhoto>
}) {
  const marks = useMemo<TimelineRailMark[]>(
    () => spectrum.map(({ year: y, count, ratio }) => ({
      // 跳转目标就是图墙上那一年的分段标题
      id: `gy-${y}`,
      meta: y === UNDATED ? UNDATED_LABEL : y,
      title: `${count} 张`,
      color: yearColor(y === UNDATED ? null : y),
      cover: coverOf.get(y)?.thumb ?? null,
      // 刻度长短就是当年张数的分档：一条长短一致的轨道读不出「哪年多」
      weight: (ratio >= 0.6 ? 'lead' : ratio >= 0.25 ? 'major' : 'minor') as TimelineRailMark['weight'],
    })),
    [spectrum, coverOf],
  )

  return (
    <TimelineRail
      marks={marks}
      ariaLabel="画廊年份时间轴"
      positionLabel="画廊浏览位置"
      showFrom="md"
      reserveBottom
      height="clamp(20rem,60vh,44rem)"
      magnify={{ radius: 0.14, scale: 2.4 }}
    />
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

/**
 * 纪念版不是缩略图索引，而是人工整理过的历史节点：日期、标题、备注与分类默认展开。
 * 图片仍然可以点进发布版灯箱，来源也在卡片上直接可见。
 */
function FeaturedPhotoCard({ photo, onOpen }: { photo: GalleryPhoto; onOpen: () => void }) {
  const sourceHref = photo.source ? gallerySourceHref(photo.source) : null
  return (
    <article className="overflow-hidden rounded-xl border border-line/80 bg-surface/45 shadow-[0_14px_40px_rgba(0,0,0,0.12)]">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`打开大图：${photoAlt(photo)}`}
        className="group relative block w-full overflow-hidden bg-black/35 text-left outline-none"
      >
        <span className="relative block aspect-[4/3] bg-black/35 sm:aspect-[16/10]">
          {/* 纪念版只有 34 张，卡片直接使用大图；全量瀑布流才使用 thumb，保证细节清晰。 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.src}
            alt={photoAlt(photo)}
            loading="lazy"
            decoding="async"
            width={photo.width}
            height={photo.height}
            className="block h-full w-full object-contain transition-[transform,filter] duration-500 ease-[var(--ease-out-expo)] group-hover:scale-[1.015] group-hover:brightness-105 group-focus-visible:brightness-110"
          />
        </span>
        {(photo.tags ?? []).length > 0 && (
          <span className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {photo.tags!.map((value) => (
              <span key={value} className="inline-flex min-w-[5.25rem] items-center justify-center whitespace-nowrap rounded-full border border-white/15 bg-black/70 px-2 py-0.5 text-[10px] text-white backdrop-blur-md sm:min-w-[6.5rem] sm:px-2.5 sm:py-1 sm:text-meta">
                {value}
              </span>
            ))}
          </span>
        )}
      </button>

      <div className="p-3 sm:p-5">
        {/* 日期行也封成一行：清单里有「2021-07-18（活动日）」这种带注的日期，
            在窄卡上会折成两行，又是一张比邻居高一截的卡。 */}
        <p className="truncate font-mono text-[10px] font-medium text-today tnum sm:overflow-visible sm:whitespace-normal sm:text-control">
          {photo.date ?? photo.year ?? UNDATED_LABEL}
          {photo.time ? <span className="text-faint"> · {photo.time}</span> : null}
        </p>
        {/* 手机端两栏窄卡要一样高，靠的不是「少写点」，而是每一行都占固定的高度：
            标题封成两行（不足两行也占两行的位置），备注和来源行整条不出现——
            它们有的照片有、有的没有，只要出现就会把这张卡比邻居多顶出一截。
            来源在手机上并没有丢：点开大图后整张图就是打开来源的链接。 */}
        {photo.title ? (
          <h3 className="mt-1.5 line-clamp-2 min-h-[2.75em] text-control font-semibold leading-snug text-ink sm:mt-2 sm:line-clamp-none sm:min-h-0 sm:text-h3">
            {photo.title}
          </h3>
        ) : (
          <p className="mt-1.5 min-h-[2.75em] text-[11px] leading-snug text-faint sm:mt-2 sm:min-h-0 sm:text-control">标题待命名</p>
        )}
        {photo.caption && <p className="mt-1.5 hidden text-[11px] leading-relaxed text-muted sm:mt-2 sm:block sm:text-control">{photo.caption}</p>}
        {photo.source &&
          (sourceHref ? (
            <a
              href={sourceHref}
              target="_blank"
              rel="noreferrer"
              className="ui-press mt-3 hidden rounded-sm text-[11px] text-live underline decoration-live/40 underline-offset-4 hover:text-ink sm:mt-4 sm:inline-flex sm:text-control"
            >
              查看公开来源
            </a>
          ) : (
            <span className="mt-3 hidden font-mono text-[10px] text-faint sm:mt-4 sm:block sm:text-meta">来源：{photo.source}</span>
          ))}
      </div>
    </article>
  )
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
        {/* 灯箱才去取大图。先把 thumb 放在同一位置当占位，大图到位前不会是一块空白。
            有公开来源时整张图就是触控区——底栏那行小字在手机上是个太小的靶子。 */}
        {sourceHref ? (
          <a
            href={sourceHref}
            target="_blank"
            rel="noreferrer"
            aria-label={`打开公开来源：${photoAlt(photo)}`}
            className="group/media relative flex max-h-full max-w-full items-center justify-center rounded-sm focus-visible:outline-none"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.src}
              alt={photoAlt(photo)}
              style={{ backgroundImage: `url(${photo.thumb})`, backgroundSize: 'cover' }}
              className="max-h-full max-w-full rounded-sm object-contain shadow-[0_40px_120px_rgba(0,0,0,0.7)]"
            />
            <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-base/80 px-3 py-1.5 text-meta text-ink opacity-0 shadow-lg backdrop-blur transition-opacity group-hover/media:opacity-100 group-focus-visible/media:opacity-100">
              查看公开来源
            </span>
          </a>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.src}
            alt={photoAlt(photo)}
            style={{ backgroundImage: `url(${photo.thumb})`, backgroundSize: 'cover' }}
            className="max-h-full max-w-full rounded-sm object-contain shadow-[0_40px_120px_rgba(0,0,0,0.7)]"
          />
        )}
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
          {(photo.tags ?? []).map((value) => (
            <span key={value} className="rounded-full border border-line/80 bg-raised/60 px-2.5 py-1 text-meta text-ink">
              {value}
            </span>
          ))}
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
                查看公开来源
              </a>
            ) : (
              <span className="shrink-0 font-mono text-meta text-faint">{photo.source}</span>
            ))}
        </div>
      </div>
    </div>
  )
}
