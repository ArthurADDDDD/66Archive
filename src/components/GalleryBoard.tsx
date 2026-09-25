'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { bucketOf, galleryFullSource, type GalleryPhoto, galleryThumbBackground, galleryThumbSources, sortBucket, UNDATED, UNDATED_LABEL } from '@/lib/gallery-photos'
import { fetchGalleryLikes, toggleGalleryLike as toggleGalleryLikeApi } from '@/lib/gallery-likes-api'
import { gallerySourceHref } from '@/lib/gallery-href'
import { yearColor } from '@/lib/ui'
import { SearchField } from './SearchField'
import { TimelineRail, type TimelineRailMark } from './TimelineRail'
import { SiteText } from './SiteText'
import { useSiteTexts } from './LiveContentProvider'
import { GalleryLiveWall } from './GalleryLiveWall'

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
type CollectionMode = 'featured' | 'all' | 'live'

/** 「全直播合集」不走照片墙；用同一个空数组，免得每次渲染都让下游 useMemo 失效。 */
const NO_PHOTOS: GalleryPhoto[] = []

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
  liveWall,
}: {
  featuredPhotos: GalleryPhoto[]
  allPhotos: GalleryPhoto[]
  /** 「全直播合集」：没有生成过合集（清单不存在）时为 null，不出这个标签。 */
  liveWall?: { count: number; hiddenIds: string[]; manifestUrl: string } | null
}) {
  const [collection, setCollection] = useState<CollectionMode>('featured')
  const [mode, setMode] = useState<ViewMode>('natural')
  const [density, setDensity] = useState<Density>('normal')
  const [tag, setTag] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const t = useSiteTexts()
  const [openId, setOpenId] = useState<string | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  // 首屏用一个常见桌面宽度排一版，挂载后立刻按真实宽度重排；窗口缩放同样跟着重排。
  const [boardW, setBoardW] = useState(1120)
  const photos = collection === 'featured' ? featuredPhotos : collection === 'all' ? allPhotos : NO_PHOTOS

  // 精选版的分类固定用 FEATURED_CATEGORY_GUIDE 排序展示；全量版没有这份人工排序表，
  // 有标签就按标签本身在素材里出现的顺序显示——目前只有「画6大赛」这一批用到。
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const photo of photos) {
      for (const value of photo.tags ?? []) counts.set(value, (counts.get(value) ?? 0) + 1)
    }
    return counts
  }, [photos])

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

  // 分享出去的「全直播合集」链接：`?view=live`，或只带了某一年的锚点。静态导出读不到
  // searchParams，只能挂载后在客户端认一次。
  useEffect(() => {
    if (!liveWall) return
    if (new URLSearchParams(window.location.search).get('view') === 'live' || window.location.hash.startsWith('#live-wall-')) {
      // 一次性的地址恢复，只在带了合集参数时才触发（同 Timeline 的做法）。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollection('live')
    }
  }, [liveWall])

  const chooseCollection = (next: CollectionMode) => {
    if (next === collection) return
    setCollection(next)
    setTag(null)
    setQ('')
    setOpenId(null)
    // 标签也写进地址：只有合集有自己的参数，切走时连同选中的那一格、年份锚点一起清掉。
    const url = new URL(window.location.href)
    if (next === 'live') {
      url.searchParams.set('view', 'live')
    } else {
      url.searchParams.delete('view')
      url.searchParams.delete('d')
      if (url.hash.startsWith('#live-wall-')) url.hash = ''
    }
    window.history.replaceState(null, '', url)
  }

  return (
    <GalleryLikesProvider>
      <div className="mb-4 flex border-y border-line/70 py-4">
        <div className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full border border-line/80 bg-surface/50 p-1" role="tablist" aria-label="画廊版本">
          <button
            type="button"
            role="tab"
            aria-selected={collection === 'featured'}
            onClick={() => chooseCollection('featured')}
            className={`ui-press shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-control transition-colors ${
              collection === 'featured' ? 'bg-ink font-medium text-base' : 'text-muted hover:text-ink'
            }`}
          >
            <SiteText id="gallery-tab-featured" vars={{ count: featuredPhotos.length }} />
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={collection === 'all'}
            onClick={() => chooseCollection('all')}
            className={`ui-press shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-control transition-colors ${
              collection === 'all' ? 'bg-ink font-medium text-base' : 'text-muted hover:text-ink'
            }`}
          >
            <SiteText id="gallery-tab-all" vars={{ count: allPhotos.length }} />
          </button>
          {liveWall && (
            <button
              type="button"
              role="tab"
              aria-selected={collection === 'live'}
              onClick={() => chooseCollection('live')}
              className={`ui-press shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-control transition-colors ${
                collection === 'live' ? 'bg-ink font-medium text-base' : 'text-muted hover:text-ink'
              }`}
            >
              <SiteText id="gallery-tab-live" vars={{ count: liveWall.count }} />
            </button>
          )}
        </div>

        {/* 控件回到文档流：原先它们住在一条可拖拽的浮层里，挡图、抢手势，
            还要记住自己被拖到哪儿。手机端不给这一排——小屏上翻图就够了。 */}
        <div className={`ml-auto hidden shrink-0 items-center gap-2 ${collection === 'live' ? '' : 'sm:flex'}`}>
          <SearchField
            value={q}
            onChange={setQ}
            placeholder={t('gallery-search-placeholder', { count: photos.length })}
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
            <SiteText id="gallery-random" />
          </button>
        </div>
      </div>

      {collection === 'live' && liveWall ? (
        <GalleryLiveWall
          hiddenIds={liveWall.hiddenIds}
          manifestUrl={liveWall.manifestUrl}
          renderLike={(likeId) => <LikeButton id={likeId} size="md" showCount />}
        />
      ) : (
      <>
      {/* 「点赞越多显示越大」不是一眼能看懂的规则，只在切到「整齐」时才用得上，
          就贴着这个开关出提示——不在全局常驻占地方，也不用单独造一套引导 UI。 */}
      {collection === 'all' && mode === 'uniform' && (
        <p className="-mt-2 mb-6 text-meta text-faint">💡 <SiteText id="gallery-boost-hint" /></p>
      )}

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

      {/* 全量版没有精选版那份人工排好序的分类表；有标签就按标签本身的顺序出按钮。
          目前只有「画6大赛」这一批水友投稿带了标签，不影响其余全量版照片——
          没有标签的照片在「全部」里能看到，但不会长出一个只有自己的空分类。 */}
      {collection === 'all' && tagCounts.size > 0 && (
        <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="按标签筛选">
          <button
            type="button"
            onClick={() => setTag(null)}
            aria-pressed={tag === null}
            className={`ui-press shrink-0 rounded-full border px-3.5 py-2 text-control transition-colors ${
              tag === null ? 'border-today/70 bg-today/10 text-today' : 'border-line/80 text-muted hover:text-ink'
            }`}
          >
            全部 · {allPhotos.length}
          </button>
          {[...tagCounts.entries()].map(([name, count]) => (
            <button
              key={name}
              type="button"
              onClick={() => setTag(name)}
              aria-pressed={tag === name}
              className={`ui-press shrink-0 rounded-full border px-3.5 py-2 text-control transition-colors ${
                tag === name ? 'border-today/70 bg-today/10 text-today' : 'border-line/80 text-muted hover:text-ink'
              }`}
            >
              {name} · {count}
            </button>
          ))}
        </div>
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
      <PhotoWall
        sections={sections}
        collection={collection}
        mode={mode}
        density={density}
        boardW={boardW}
        boardRef={boardRef}
        onOpen={setOpenId}
      />

      {visible.length === 0 && <p className="py-16 text-center text-meta text-faint"><SiteText id="gallery-empty" /></p>}

      {openIndex >= 0 &&
        typeof document !== 'undefined' &&
        createPortal(
          <Lightbox photo={visible[openIndex]} index={openIndex} total={visible.length} visible={visible} onClose={() => setOpenId(null)} onStep={step} />,
          document.body,
        )}
      </>
      )}
    </GalleryLikesProvider>
  )
}

/**
 * 年份分段 + 三种排布模式的图墙。单独拆出来，是因为「整齐」模式要按点赞数算
 * 哪些照片放大——这份排名要看到当前可见的全部照片才算得准，不能按年份分段
 * 各算各的（一年只有两三张时，排名毫无意义），所以在这一层（Provider 的
 * 后代组件，能读到点赞聚合）一次性算好，再按年份分发下去。
 */
function PhotoWall({
  sections,
  collection,
  mode,
  density,
  boardW,
  boardRef,
  onOpen,
}: {
  sections: { year: string; photos: GalleryPhoto[] }[]
  collection: CollectionMode
  mode: ViewMode
  density: Density
  boardW: number
  boardRef: React.RefObject<HTMLDivElement | null>
  onOpen: (id: string) => void
}) {
  const counts = useGalleryLikeCounts()

  // 「整齐」模式才用得上：按点赞数在当前可见范围内排一次名，前 ~12%（且赞数 > 0）
  // 判定为「热门」，网格里占 2×2。其它模式忽略这份计算，反正用不上。
  const boostedIds = useMemo(() => {
    if (collection === 'featured' || mode !== 'uniform') return new Set<string>()
    const liked = sections
      .flatMap((section) => section.photos)
      .map((photo) => ({ id: photo.id, count: counts[photo.id] ?? 0 }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count)
    const boostCount = Math.max(1, Math.ceil(liked.length * 0.12))
    return new Set(liked.slice(0, boostCount).map((entry) => entry.id))
  }, [sections, collection, mode, counts])

  return (
    <div className="gallery-wall pb-16 sm:pb-28" style={{ '--cell-w': DENSITY[density].cell } as React.CSSProperties}>
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
                <span className="shrink-0 text-meta text-faint"><SiteText id="gallery-year-undated" /></span>
              ) : (
                <Link href={`/archive/?y=${y}`} prefetch={false} className="ui-press shrink-0 rounded-sm text-meta text-faint transition-colors hover:text-live">
                  <SiteText id="gallery-year-link" />
                </Link>
              )}
            </header>

            {/* 纪念版：不写 items-start——让同一行的卡片对齐到同一高度，
                将来真有条目多出一行文字，也是整行一起长，不会只戳出一张。 */}
            {collection === 'featured' ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
                {list.map((p) => (
                  <FeaturedPhotoCard key={p.id} photo={p} onOpen={() => onOpen(p.id)} />
                ))}
              </div>
            ) : mode === 'natural' ? (
              <div className="flex flex-col" style={{ gap: GAP }}>
                {buildRows(list, boardW, DENSITY[density].targetH(boardW)).map((row, i) => (
                  <div key={i} className="flex" style={{ gap: GAP, height: row.height }}>
                    {row.photos.map((p) => (
                      <PhotoCell key={p.id} photo={p} rowHeight={row.height} stretched={row.stretched} onOpen={() => onOpen(p.id)} />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="photo-uniform">
                {list.map((p) => (
                  <PhotoCell key={p.id} photo={p} uniform boosted={boostedIds.has(p.id)} onOpen={() => onOpen(p.id)} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
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
 * 点赞：匿名、点了立刻可见反馈（乐观更新），真实计数走后台
 * `/api/likes/gallery`——同一批接口撑着投票和纠错，身份靠签名 cookie 认，
 * 见公开仓 gallery-likes-api.ts 与后台 lib/likes/*。
 *
 * 整块画廊只在挂载时拉一次全量聚合（GET 一次，不按张查），点赞/取消都是
 * 对这一份内存状态的乐观更新，失败了再悄悄撤回——低风险的匿名互动，
 * 不值得为一次点赞失败弹个提示打断浏览。
 */
type GalleryLikesState = { counts: Record<string, number>; liked: Set<string> }

const GalleryLikesContext = createContext<{
  countOf: (id: string) => number
  isLiked: (id: string) => boolean
  toggle: (id: string) => void
  /** 原始计数表，只给「整齐」网格算排名用——按 id 单查用 countOf。 */
  counts: Record<string, number>
} | null>(null)

function GalleryLikesProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GalleryLikesState>({ counts: {}, liked: new Set() })

  useEffect(() => {
    let cancelled = false
    fetchGalleryLikes()
      .then((result) => {
        if (cancelled) return
        setState({ counts: result.counts, liked: new Set(result.likedByViewer) })
      })
      .catch(() => {
        // 拿不到聚合数据（本地开发没接后台服务、网络问题）就都当「暂无点赞」，
        // 不影响画廊其余部分——点赞是锦上添花，不是看图的必要条件。
      })
    return () => {
      cancelled = true
    }
  }, [])

  const toggle = useCallback((id: string) => {
    const wasLiked = (current: GalleryLikesState) => current.liked.has(id)
    setState((current) => {
      const liked = new Set(current.liked)
      const next = !wasLiked(current)
      if (next) liked.add(id)
      else liked.delete(id)
      return { liked, counts: { ...current.counts, [id]: Math.max(0, (current.counts[id] ?? 0) + (next ? 1 : -1)) } }
    })

    toggleGalleryLikeApi(id)
      .then((result) => {
        setState((current) => {
          const liked = new Set(current.liked)
          if (result.liked) liked.add(id)
          else liked.delete(id)
          return { liked, counts: { ...current.counts, [id]: result.count } }
        })
      })
      .catch(() => {
        // 请求失败（限流、网络抖动）：把这次乐观更新原样撤回，不留一个和服务端对不上的本地状态。
        setState((current) => {
          const liked = new Set(current.liked)
          const hadOptimisticallyAdded = liked.has(id)
          if (hadOptimisticallyAdded) liked.delete(id)
          else liked.add(id)
          return {
            liked,
            counts: { ...current.counts, [id]: Math.max(0, (current.counts[id] ?? 0) + (hadOptimisticallyAdded ? -1 : 1)) },
          }
        })
      })
  }, [])

  const value = useMemo(
    () => ({
      countOf: (id: string) => state.counts[id] ?? 0,
      isLiked: (id: string) => state.liked.has(id),
      toggle,
      counts: state.counts,
    }),
    [state, toggle],
  )

  return <GalleryLikesContext.Provider value={value}>{children}</GalleryLikesContext.Provider>
}

function useGalleryLikes(id: string) {
  const ctx = useContext(GalleryLikesContext)
  if (!ctx) throw new Error('useGalleryLikes 必须在 GalleryLikesProvider 内使用')
  return { liked: ctx.isLiked(id), count: ctx.countOf(id), toggle: () => ctx.toggle(id) }
}

function useGalleryLikeCounts() {
  const ctx = useContext(GalleryLikesContext)
  if (!ctx) throw new Error('useGalleryLikeCounts 必须在 GalleryLikesProvider 内使用')
  return ctx.counts
}

/** Instagram 同款红心：#ed4956，实心；未点赞时只描边，不填色。 */
const LIKE_RED = '#ed4956'

function HeartIcon({ liked, size, pop }: { liked: boolean; size: number; pop: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`transition-transform duration-200 ease-[var(--ease-out-expo)] ${pop ? 'scale-125' : 'scale-100'}`}
      fill={liked ? LIKE_RED : 'none'}
      stroke={liked ? LIKE_RED : 'currentColor'}
      strokeWidth={liked ? 0 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20.5s-7.23-4.35-10.06-8.51C.29 9.36 1.06 5.6 4.53 4.3c2.36-.88 4.87.02 6.68 2.28 1.4-1.75 3.02-2.6 4.69-2.6 1.92 0 3.53 1.04 4.42 2.85 1.6 2.6.6 6.23-2.32 9.66C15.23 16.15 12 20.5 12 20.5z" />
    </svg>
  )
}

/** 点赞数很大的时候按中文习惯折成「万」，跟「1.2k」那套英文缩写不是一个路子。 */
function formatLikeCount(count: number): string {
  if (count < 10000) return count.toLocaleString('zh-CN')
  const wan = count / 10000
  return `${wan.toFixed(wan >= 100 ? 0 : 1)}万`
}

/**
 * 样式照 Instagram 的路子来：未点赞是描边心，点了立刻变实心红心并弹一下——
 * 这个反馈本身就是「点没点得中」的确认，不用额外文字提示。`showCount` 打开时
 * 数字紧跟在心形右边，0 赞不显示数字（一屏全是「0」比不显示更打眼、更冷清）。
 */
function LikeButton({
  id,
  size = 'md',
  className = '',
  showCount = false,
}: {
  id: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showCount?: boolean
}) {
  const { liked, count, toggle } = useGalleryLikes(id)
  const [pop, setPop] = useState(false)
  const iconSize = size === 'lg' ? 24 : size === 'sm' ? 16 : 20

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        const willLike = !liked
        toggle()
        if (willLike) {
          setPop(true)
          window.setTimeout(() => setPop(false), 220)
        }
      }}
      aria-pressed={liked}
      aria-label={liked ? '取消点赞' : '点赞'}
      className={`ui-press inline-flex shrink-0 items-center gap-1 rounded-full text-faint transition-colors hover:text-ink ${className}`}
    >
      <HeartIcon liked={liked} size={iconSize} pop={pop} />
      {showCount && count > 0 && (
        <span className={`font-mono tnum ${size === 'sm' ? 'text-[10px]' : 'text-meta'}`}>{formatLikeCount(count)}</span>
      )}
    </button>
  )
}

function GalleryThumbnail({
  photo,
  sizes,
  className,
}: {
  photo: GalleryPhoto
  sizes: string
  className: string
}) {
  const sources = galleryThumbSources(photo.thumb)
  return (
    <picture className="block h-full w-full">
      {sources ? <source type="image/avif" srcSet={sources.avif} sizes={sizes} /> : null}
      {sources ? <source type="image/webp" srcSet={sources.webp} sizes={sizes} /> : null}
      <img
        src={photo.thumb}
        alt={photoAlt(photo)}
        loading="lazy"
        decoding="async"
        width={photo.width}
        height={photo.height}
        className={className}
      />
    </picture>
  )
}

/**
 * 纪念版不是缩略图索引，而是人工整理过的历史节点：日期、标题、备注与分类默认展开。
 * 图片仍然可以点进发布版灯箱，来源也在卡片上直接可见。
 */
function FeaturedPhotoCard({ photo, onOpen }: { photo: GalleryPhoto; onOpen: () => void }) {
  const sourceHref = photo.source ? gallerySourceHref(photo.source) : null
  return (
    <article data-gallery-photo={photo.id} data-gallery-featured="" className="overflow-hidden rounded-xl border border-line/80 bg-surface/45 shadow-[0_14px_40px_rgba(0,0,0,0.12)]">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`打开大图：${photoAlt(photo)}`}
        data-analytics-event="content.open"
        data-analytics-target={`gallery:${photo.id}`}
        className="group relative block w-full overflow-hidden bg-black/35 text-left outline-none"
      >
        <span className="relative block aspect-[4/3] bg-black/35 sm:aspect-[16/10]">
          {/* 卡片只取响应式缩略图；原图严格等到用户打开灯箱后再请求。 */}
          <GalleryThumbnail
            photo={photo}
            sizes="(min-width: 1280px) 560px, (min-width: 640px) 45vw, 50vw"
            className="block h-full w-full object-contain transition-[transform,filter] duration-500 ease-[var(--ease-out-expo)] group-hover:scale-[1.015] group-hover:brightness-105 group-focus-visible:brightness-110"
          />
        </span>
        {(photo.tags ?? []).length > 0 && (
          /* 分类角标只是提示，不该压住画面：不设最小宽度、贴角、半透明。
             以前 min-w 5.25rem 在手机两栏窄卡上几乎占掉半张图宽。 */
          <span className="pointer-events-none absolute left-1.5 top-1.5 flex flex-wrap gap-1 sm:left-2.5 sm:top-2.5">
            {photo.tags!.map((value) => (
              <span key={value} className="inline-flex items-center whitespace-nowrap rounded-full bg-black/55 px-1.5 py-px text-[9px] leading-snug text-white/85 backdrop-blur-sm sm:px-2 sm:py-0.5 sm:text-[11px]">
                {value}
              </span>
            ))}
          </span>
        )}
      </button>

      <div className="p-3 sm:p-5">
        {/* 点赞单独占一行放在最上面，仿 Instagram 图片下方的操作栏——
            比塞进日期行显眼得多，一眼就能看见、够得着点。 */}
        <LikeButton id={photo.id} size="md" className="-ml-1.5 mb-1 p-1.5 hover:bg-raised/70" showCount />
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
          <p className="mt-1.5 min-h-[2.75em] text-[11px] leading-snug text-faint sm:mt-2 sm:min-h-0 sm:text-control"><SiteText id="gallery-untitled" /></p>
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
              <SiteText id="gallery-source-link" />
            </a>
          ) : (
            <span className="mt-3 hidden font-mono text-[10px] text-faint sm:mt-4 sm:block sm:text-meta">来源：{photo.source}</span>
          ))}
        {photo.credit && (
          <span className="mt-1 hidden text-[10px] text-faint sm:mt-1.5 sm:block sm:text-meta">{photo.credit}</span>
        )}
      </div>
    </article>
  )
}

/** 「整齐」模式里热门照片占的格数。固定 2×2——封顶，不随点赞数无限变大。 */
const BOOST_SPAN = 2

function PhotoCell({
  photo,
  uniform = false,
  rowHeight,
  stretched = true,
  boosted = false,
  onOpen,
}: {
  photo: GalleryPhoto
  uniform?: boolean
  /** natural 模式下这一行的高度；未铺满的行据此算出每张图自己的真实宽度，不交给 flex-grow 撑。 */
  rowHeight?: number
  /** 这一行是否铺满了容器宽度。false 时关掉 flex-grow——见 buildRows 顶部注释。 */
  stretched?: boolean
  /** 仅「整齐」模式：这张照片点赞数排进当前可见范围前 12%，网格里占 2×2。 */
  boosted?: boolean
  onOpen: () => void
}) {
  const ar = photo.width / photo.height
  const naturalStyle: React.CSSProperties | undefined = uniform
    ? boosted
      ? { gridColumn: `span ${BOOST_SPAN}`, gridRow: `span ${BOOST_SPAN}` }
      : undefined
    : stretched
      ? { flex: `${ar} 1 0` }
      // 未铺满的行：宽度按真实宽高比 × 行高算死，不参与 flex-grow 分配剩余空间，
      // 行末留白，好过把这几张图硬撑满整行宽度、挤出裁切。
      : { flex: '0 0 auto', width: rowHeight ? rowHeight * ar : undefined }
  return (
    // 外层从 <button> 改成 <div>：点赞按钮要浮在缩略图上单独可点，
    // 不能把它塞进「打开大图」那个 <button> 里——按钮不能嵌按钮。
    // flex 行距分配用的那份 naturalStyle 也跟着挪到这层，视觉效果不变。
    <div data-gallery-photo={photo.id} className="group relative h-full min-w-0 overflow-hidden rounded-[3px] bg-raised" style={naturalStyle}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`打开大图：${photoAlt(photo)}`}
        data-analytics-event="content.open"
        data-analytics-target={`gallery:${photo.id}`}
        /**
         * `focus-ring-inset`：全局 :focus-visible 的柔光画在盒子外面，会被上面那层
         * overflow-hidden 整圈裁掉，键盘焦点在网格里等于隐形。
         * `group/photo`：外层 div 那个 `group` 没有 tabindex，永远不会进 :focus-visible，
         * 所以下面时间戳条的 `group-focus-visible:` 从来没生效过；命名 group 挂在真正
         * 被聚焦的这个 button 上才对。hover 仍然走外层那个 group，范围不变。
         */
        className="group/photo block h-full w-full text-left outline-none focus-ring-inset"
      >
        <span className={`block h-full ${uniform ? 'aspect-square' : ''}`}>
          {/* 列表一律用浏览器按显示宽度挑选的现代格式缩略图。 */}
          <GalleryThumbnail
            photo={photo}
            sizes={
              uniform
                ? boosted
                  ? '(min-width: 1024px) 330px, 66vw'
                  : '(min-width: 1024px) 165px, 33vw'
                : '(min-width: 1024px) 360px, 50vw'
            }
            className="block h-full w-full object-cover transition-[transform,filter] duration-500 ease-[var(--ease-out-expo)] group-hover:scale-[1.03] group-hover:brightness-110"
          />
        </span>
        {/* 平时是纯图，hover / 聚焦才浮出时间戳——一屏几十张时，常驻文字才是疲劳的来源。 */}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-2 pb-1.5 pt-8 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible/photo:opacity-100">
          <span className="truncate font-mono text-meta tnum text-white/90">{photo.date ?? photo.year ?? UNDATED_LABEL}</span>
          {photo.time && <span className="shrink-0 font-mono text-meta tnum text-white/55">{photo.time}</span>}
        </span>
      </button>
      {/* 小图密度高，点赞常驻显示（不等 hover）才找得到、点得中；
          深色圆底垫在下面，浅色/白色图也能看清这颗心。 */}
      <LikeButton
        id={photo.id}
        size="sm"
        className="absolute right-1 top-1 bg-black/45 px-1.5 py-1 text-white/90 backdrop-blur-sm hover:bg-black/65 hover:text-white"
        showCount
      />
    </div>
  )
}

/**
 * 灯箱里的大图。
 *
 * 用 `<picture>` 而不是给 `<img>` 加 `srcSet`：srcset 不做格式协商，把 webp 塞进去，
 * 认不出的浏览器会拿到一张画不出来的图。派生文件见 `lib/gallery-photos.ts` 的
 * `galleryFullSource`；没有派生文件（例如 `anniv_*` 那批）就照常只用原图。
 *
 * `prefetch` 的那两张是左右邻居：不显示，但走同一套选择逻辑。用 1px 全透明定位而不是
 * `display: none`——`display: none` 的子树里浏览器可以不发请求，那预取就白写了。
 */
function LightboxImage({
  photo,
  onLoad,
  prefetch = false,
}: {
  photo: GalleryPhoto
  onLoad?: () => void
  prefetch?: boolean
}) {
  const webp = galleryFullSource(photo.src)
  return (
    <picture className="contents">
      {webp ? <source type="image/webp" srcSet={webp} /> : null}
      <img
        src={photo.src}
        alt={prefetch ? '' : photoAlt(photo)}
        aria-hidden={prefetch || undefined}
        loading="eager"
        decoding="async"
        fetchPriority={prefetch ? 'low' : 'high'}
        onLoad={onLoad}
        // 现场编辑靠它认出「点的是哪张照片」；预取的邻图不标，免得被当成当前这张。
        data-gallery-photo={prefetch ? undefined : photo.id}
        style={
          prefetch
            ? { position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }
            : { backgroundImage: galleryThumbBackground(photo.thumb), backgroundSize: 'cover' }
        }
        className={
          // min-h-0/min-w-0：img 作为 flex 子项默认 min-height/min-width 是 auto（按内容撑开），
          // 竖长图（画6大赛那批漫画页常见）高度超出视口时 max-h-full 不生效，顶部/底部被裁掉。
          prefetch ? '' : 'max-h-full max-w-full min-h-0 min-w-0 rounded-sm object-contain shadow-[0_40px_120px_rgba(0,0,0,0.7)]'
        }
      />
    </picture>
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
  /** 焦点收束的边界：Tab 只在这个节点内部循环。 */
  const dialogRef = useRef<HTMLDivElement>(null)
  const sourceHref = photo.source ? gallerySourceHref(photo.source) : null
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)

  // 当前大图加载完成后才低优先级预取左右各一张。旧策略一打开就并发取 4 张邻图，
  // 会让真正要看的这一张和后台下载争带宽，在慢网或多人同时访问时尤其得不偿失。
  //
  // 预取**必须和真正显示时走同一条选择逻辑**，所以这里渲染两个隐藏的 `<LightboxImage>`，
  // 而不是像从前那样 `new Image()` 直接给 `src`：`new Image()` 没有 `<source>`，
  // 拿到的永远是原 jpg，而显示时用的是 webp——那等于每张邻图白下一份。
  // 卸载时 React 会把节点摘掉，浏览器照样会中止还没完成的请求，和从前清 `src` 等效。
  const neighbors =
    visible.length > 0 && loadedSrc === photo.src
      ? [-1, 1].map((delta) => visible[(index + delta + visible.length) % visible.length])
      : []

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
      else if (e.key === 'Tab') {
        /**
         * 焦点收束。`aria-modal="true"` 只约束辅助技术的虚拟光标，对物理 Tab 键没有
         * 任何作用——这一层是 portal 到 body 的，背景既没有 inert 也没有 aria-hidden，
         * 所以 Tab 走完灯箱里最后一个元素就落到被全屏遮罩完全盖住的页面控件上：
         * 屏幕上只看得见灯箱，焦点却在背后的站点导航里，按 Enter 会在灯箱后面展开菜单。
         */
        const root = dialogRef.current
        if (!root) return
        const focusable = Array.from(
          root.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
          // getClientRects 对 position:fixed 也成立，offsetParent 不成立。
        ).filter((el) => el.getClientRects().length > 0)
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = document.activeElement as HTMLElement | null
        const outside = !active || !root.contains(active)
        if (e.shiftKey ? active === first || outside : active === last || outside) {
          e.preventDefault()
          ;(e.shiftKey ? last : first).focus()
        }
      }
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
    <div ref={dialogRef} className="fixed inset-0 z-50 flex flex-col" role="dialog" aria-modal="true" aria-label={photoAlt(photo)}>
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
            有公开来源时整张图就是触控区——底栏那行小字在手机上是个太小的靶子。
            但**只有图本身**是：这层 <a> 为了给图片的 max-h-full 一个确定的分母撑满了整列高度，
            横图上下那两大片空白也算进了链接，想点空白关掉灯箱却跳去了来源页。
            所以 <a> 自己 pointer-events-none，只把图片设回 auto——点图照样触发链接，
            点空白则穿透到下面这层，按「点的是这层本身」关闭。 */}
        {sourceHref ? (
          <a
            href={sourceHref}
            target="_blank"
            rel="noreferrer"
            aria-label={`打开公开来源：${photoAlt(photo)}`}
            // h-full 是关键：这层 <a> 默认高度由内容撑开（align-items: center 不会拉伸它），
            // 对浏览器来说是「不确定高度」，图片自己的 max-h-full（百分比）会被当成 none 直接失效——
            // 竖长图（画6大赛那批漫画页）因此顶部/底部都被裁掉，需要 h-full 把这层的高度钉死，
            // 图片的百分比 max-height 才有一个确定的分母可以算。
            className="group/media pointer-events-none relative flex h-full min-h-0 min-w-0 max-h-full max-w-full items-center justify-center rounded-sm focus-visible:outline-none [&_img]:pointer-events-auto [&_img]:cursor-pointer"
          >
            <LightboxImage photo={photo} onLoad={() => setLoadedSrc(photo.src)} />
            <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-base/80 px-3 py-1.5 text-meta text-ink opacity-0 shadow-lg backdrop-blur transition-opacity group-hover/media:opacity-100 group-focus-visible/media:opacity-100">
              <SiteText id="gallery-source-link" />
            </span>
          </a>
        ) : (
          <LightboxImage photo={photo} onLoad={() => setLoadedSrc(photo.src)} />
        )}
        {neighbors.map((neighbor) => (
          <LightboxImage key={`prefetch-${neighbor.id}`} photo={neighbor} prefetch />
        ))}
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
          <LikeButton id={photo.id} size="lg" className="p-1 hover:bg-raised/60" showCount />
          <button ref={closeRef} onClick={onClose} className="ui-press rounded-sm px-2 py-1 text-meta text-muted transition-colors hover:text-ink">
            关闭 · Esc
          </button>
        </div>

        <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
          {photo.title ? <h3 className="text-body font-medium text-ink">{photo.title}</h3> : <span className="text-meta text-faint"><SiteText id="gallery-untitled" /></span>}
          {photo.caption && <p className="max-w-3xl text-meta leading-relaxed text-muted">{photo.caption}</p>}
          {photo.source &&
            (sourceHref ? (
              <a
                href={sourceHref}
                target="_blank"
                rel="noreferrer"
                className="ui-press shrink-0 text-meta text-live underline decoration-live/40 underline-offset-4 hover:text-ink"
              >
                <SiteText id="gallery-source-link" />
              </a>
            ) : (
              <span className="shrink-0 font-mono text-meta text-faint">{photo.source}</span>
            ))}
          {/* 访客投稿的署名。和 source 同一档字重（text-meta text-faint），
              不给链接不给颜色——写出来但不抢眼是这一行的全部设计意图。 */}
          {photo.credit && <span className="shrink-0 text-meta text-faint">{photo.credit}</span>}
        </div>
      </div>
    </div>
  )
}
