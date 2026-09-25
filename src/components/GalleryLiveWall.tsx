'use client'

import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react'
import Link from 'next/link'
import { yearColor } from '@/lib/ui'
import { SiteText } from './SiteText'
import { TimelineRail, type TimelineRailMark } from './TimelineRail'

/**
 * 画廊「全直播合集」：档案里每一场直播各一帧，按时间拼成一整面墙。
 *
 * 墙本身是**预先拼好的长图**（scripts/live-wall-build.py 生成，按年份切片），不是几千个
 * `<img>`：几千张小图意味着几千次请求，而一面墙真正要的只是「看过去是什么样」。
 * 每一格是哪一场不靠 DOM 表达，而是按指针落点和清单里的顺序算出来——所以格子不必
 * 各自带链接，悬停/轻点时才告诉你这是哪一天。
 *
 * 清单与切片都在 `/gallery/live-wall/` 下，只有切到这个标签才去取，不拖慢画廊首屏。
 *
 * 图是生成时烤死的，之后在后台隐藏的条目没法从图上抠掉，所以按 `hiddenIds` 在对应
 * 格子上盖一块底色：不显示画面，也不响应悬停。
 */

type TileKind = 'f' | 'c'
type Tile = [id: string, date: string, title: string, kind: TileKind]
type Slice = { year: string; src: string; first: number; count: number }
type Manifest = { version: 1; cols: number; tileW: number; tileH: number; slices: Slice[]; tiles: Tile[] }

const MANIFEST_URL = '/gallery/live-wall/index.json'

const KIND_NOTE: Record<TileKind, string | null> = {
  f: null,
  c: '录像封面',
}

type Pointer = { index: number; x: number; y: number }

export function GalleryLiveWall({ hiddenIds }: { hiddenIds: string[] }) {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [failed, setFailed] = useState(false)
  const [hover, setHover] = useState<Pointer | null>(null)
  const [picked, setPicked] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    fetch(MANIFEST_URL)
      .then((response) => (response.ok ? (response.json() as Promise<Manifest>) : Promise.reject(new Error(String(response.status)))))
      .then((data) => active && setManifest(data))
      .catch(() => active && setFailed(true))
    return () => {
      active = false
    }
  }, [])

  const hidden = useMemo(() => new Set(hiddenIds), [hiddenIds])

  const years = useMemo(() => {
    if (!manifest) return []
    const map = new Map<string, { year: string; slices: Slice[]; count: number }>()
    for (const slice of manifest.slices) {
      const bucket = map.get(slice.year) ?? { year: slice.year, slices: [], count: 0 }
      bucket.slices.push(slice)
      for (let i = slice.first; i < slice.first + slice.count; i += 1) {
        if (!hidden.has(manifest.tiles[i][0])) bucket.count += 1
      }
      map.set(slice.year, bucket)
    }
    return [...map.values()]
  }, [manifest, hidden])

  // 右侧年份轨：与照片墙同一套，刻度长短按当年场次分档，悬停预览用当年第一张切片。
  const marks = useMemo<TimelineRailMark[]>(() => {
    const max = Math.max(1, ...years.map((bucket) => bucket.count))
    return years.map((bucket) => {
      const ratio = bucket.count / max
      return {
        id: `live-wall-${bucket.year}`,
        meta: bucket.year,
        title: `${bucket.count} 场`,
        color: yearColor(bucket.year),
        cover: bucket.slices[0]?.src ?? null,
        weight: (ratio >= 0.6 ? 'lead' : ratio >= 0.25 ? 'major' : 'minor') as TimelineRailMark['weight'],
      }
    })
  }, [years])

  const shown = useMemo(() => (manifest ? manifest.tiles.filter((tile) => !hidden.has(tile[0])) : []), [manifest, hidden])

  useEffect(() => {
    if (picked === null) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setPicked(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picked])

  if (failed) return <p className="py-16 text-center text-meta text-faint">合集清单暂时没有加载成功，稍后再试。</p>
  if (!manifest) return <p className="py-16 text-center text-meta text-faint">正在铺开……</p>

  const { cols } = manifest

  /** 指针落在切片的哪一格。落在最后一行的空位、或被隐藏的格子上时返回 null。 */
  const tileAt = (slice: Slice, event: ReactMouseEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const rows = Math.ceil(slice.count / cols)
    const col = Math.min(cols - 1, Math.max(0, Math.floor(((event.clientX - box.left) / box.width) * cols)))
    const row = Math.min(rows - 1, Math.max(0, Math.floor(((event.clientY - box.top) / box.height) * rows)))
    const offset = row * cols + col
    if (offset >= slice.count) return null
    const index = slice.first + offset
    return hidden.has(manifest.tiles[index][0]) ? null : index
  }

  const hoverTile = hover ? manifest.tiles[hover.index] : null
  const pickedTile = picked === null ? null : manifest.tiles[picked]

  return (
    <div>
      <p className="measure-body mb-6 text-body leading-relaxed text-muted tnum">
        <SiteText
          id="gallery-live-intro"
          vars={{ count: shown.length, from: shown[0]?.[1] ?? '', to: shown[shown.length - 1]?.[1] ?? '' }}
        />
      </p>

      <nav className="mb-8 flex flex-wrap gap-2" aria-label="跳到年份">
        {years.map((bucket) => (
          <a
            key={bucket.year}
            href={`#live-wall-${bucket.year}`}
            className="ui-press shrink-0 rounded-full border border-line/80 px-3 py-1.5 text-meta text-muted tnum transition-colors hover:border-today/60 hover:text-today"
          >
            {bucket.year} · {bucket.count}
          </a>
        ))}
      </nav>

      <TimelineRail
        marks={marks}
        ariaLabel="全直播合集年份时间轴"
        positionLabel="全直播合集浏览位置"
        showFrom="md"
        reserveBottom
        height="clamp(20rem,60vh,44rem)"
        magnify={{ radius: 0.14, scale: 2.4 }}
      />

      <div className="gallery-wall space-y-8">
        {years.map((bucket) => (
          <section key={bucket.year} id={`live-wall-${bucket.year}`} className="scroll-mt-24">
            <h3 className="mb-2 flex items-baseline gap-3 text-control">
              <span className="font-mono font-semibold tnum" style={{ color: yearColor(bucket.year) }}>{bucket.year}</span>
              <span className="text-meta text-faint tnum">{bucket.count} 场</span>
            </h3>
            {bucket.slices.map((slice) => {
              const rows = Math.ceil(slice.count / cols)
              return (
                <div
                  key={slice.src}
                  className="relative cursor-crosshair select-none bg-raised"
                  style={{ aspectRatio: `${cols * manifest.tileW} / ${rows * manifest.tileH}` }}
                  onPointerMove={(event) => {
                    if (event.pointerType !== 'mouse') return
                    const index = tileAt(slice, event)
                    setHover(index === null ? null : { index, x: event.clientX, y: event.clientY })
                  }}
                  onPointerLeave={() => setHover(null)}
                  onClick={(event) => {
                    const index = tileAt(slice, event)
                    setPicked(index === picked ? null : index)
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- 静态导出，切片本身就是成品图 */}
                  <img
                    src={slice.src}
                    alt={`${slice.year} 年直播截图拼图`}
                    width={cols * manifest.tileW}
                    height={rows * manifest.tileH}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="block h-full w-full"
                  />
                  {manifest.tiles.slice(slice.first, slice.first + slice.count).map((tile, offset) => {
                    const index = slice.first + offset
                    const isHidden = hidden.has(tile[0])
                    if (!isHidden && index !== picked) return null
                    const col = offset % cols
                    const row = Math.floor(offset / cols)
                    return (
                      <span
                        key={tile[0]}
                        aria-hidden
                        className={`pointer-events-none absolute ${isHidden ? 'bg-base' : 'outline outline-2 -outline-offset-2 outline-today'}`}
                        style={{
                          left: `${(col / cols) * 100}%`,
                          top: `${(row / rows) * 100}%`,
                          width: `${100 / cols}%`,
                          height: `${100 / rows}%`,
                        }}
                      />
                    )
                  })}
                </div>
              )
            })}
          </section>
        ))}
      </div>

      <p className="mt-8 text-meta text-faint"><SiteText id="gallery-live-note" /></p>

      {hoverTile && hover && picked === null && (
        <div
          className="pointer-events-none fixed z-40 max-w-[18rem] rounded-md border border-line bg-surface/95 px-3 py-2 text-meta shadow-lg backdrop-blur"
          style={{ left: Math.min(hover.x + 14, window.innerWidth - 300), top: hover.y + 16 }}
        >
          <TileLabel tile={hoverTile} />
        </div>
      )}

      {pickedTile && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-page py-3 backdrop-blur sm:bottom-4 sm:left-1/2 sm:right-auto sm:w-[34rem] sm:-translate-x-1/2 sm:rounded-lg sm:border">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 text-control">
              <TileLabel tile={pickedTile} />
            </div>
            <Link
              prefetch={false}
              href={`/e/${pickedTile[0]}/`}
              className="ui-press shrink-0 rounded-sm text-meta text-live underline decoration-live/40 underline-offset-4 hover:text-ink"
            >
              看这一场 →
            </Link>
            <button
              type="button"
              onClick={() => setPicked(null)}
              aria-label="关闭"
              className="ui-press shrink-0 rounded-full px-2 text-muted hover:text-ink"
            >
              ✕
            </button>
          </div>
        </div>
      )}
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
