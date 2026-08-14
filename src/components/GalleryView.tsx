'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { gallerySourceHref } from '@/lib/gallery-href'
import type { GalleryItem } from '@/lib/gallery'
import { SearchField } from './SearchField'

/**
 * 记忆画廊：图片优先的 masonry，图注全部收进灯箱。
 * 轻搜索（按年份 / 画面说明）+ 随便翻一张。灯箱：大图 + 标题 / 日期 / 注脚 / 来源 / 同年编年史。
 * Escape 关闭、聚焦闭按钮、焦点归还打开卡片；低清图原样展示，不做任何放大修复。
 */
export function GalleryView({ items }: { items: GalleryItem[] }) {
  const [q, setQ] = useState('')
  const [year, setYear] = useState<string | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const years = useMemo(() => [...new Set(items.map((i) => i.year))].sort(), [items])

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return items.filter((i) => {
      if (year && i.year !== year) return false
      if (!needle) return true
      return `${i.alt} ${i.caption} ${i.year} ${i.date}`.toLowerCase().includes(needle)
    })
  }, [items, q, year])

  const openAt = (index: number) => setOpen(index)
  const step = (delta: number) => {
    if (open === null) return
    setOpen((open + delta + visible.length) % visible.length)
  }
  const randomOpen = () => {
    if (visible.length === 0) return
    openAt(Math.floor(Math.random() * visible.length))
  }

  return (
    <>
      {/* 控制行 */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchField
          value={q}
          onChange={setQ}
          placeholder={`搜索年份或画面说明 · ${items.length} 张`}
          ariaLabel="搜索画面"
          inputClassName="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-control text-ink placeholder:text-faint transition-[border-color,box-shadow,background-color] duration-300 hover:bg-raised/70 focus:border-live focus:bg-raised/70 focus:shadow-[0_0_0_3px_rgba(91,200,232,0.1)] focus:outline-none sm:max-w-[18.75rem] sm:py-2"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => {
                setYear((current) => (current === y ? null : y))
                setOpen(null)
              }}
              aria-pressed={year === y}
              className={`ui-press rounded-full border px-3 py-2.5 text-meta transition-colors tnum sm:py-1.5 ${
                year === y ? 'border-today/70 bg-today/10 text-today' : 'border-line/80 bg-surface/50 text-muted hover:border-muted/60 hover:text-ink'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={randomOpen}
          className="ui-press ml-auto rounded-full border border-line/80 bg-surface/50 px-4 py-2.5 text-meta text-muted transition-colors hover:border-today/60 hover:text-today sm:py-1.5"
        >
          随便翻一张 ↯
        </button>
      </div>

      {q || year ? (
        <p className="mt-3 text-meta text-faint tnum">
          找到 {visible.length} 张{(q || year) && (
            <button type="button" onClick={() => { setQ(''); setYear(null); setOpen(null) }} className="ml-2 text-live underline underline-offset-4">
              清除筛选
            </button>
          )}
        </p>
      ) : null}

      {/* 统一卡片比例：画廊按视频封面节奏排列，不让原图尺寸把同一行撑成高低错落。 */}
      <div ref={gridRef} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item, index) => (
          <GalleryCard key={item.id} item={item} onOpen={() => openAt(index)} />
        ))}
      </div>
      {visible.length === 0 && (
        <p className="mt-10 text-meta text-faint">没有找到符合的画面。</p>
      )}

      {/* 灯箱 */}
      {open !== null && visible[open] && (
        typeof document !== 'undefined' && createPortal(
          <Lightbox
            item={visible[open]}
            index={open}
            total={visible.length}
            onClose={() => setOpen(null)}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
          />,
          document.body,
        )
      )}
    </>
  )
}

function GalleryCard({ item, onOpen }: { item: GalleryItem; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      aria-label={`打开大图：${item.alt}`}
      className="ui-press group block w-full overflow-hidden rounded-xl border border-line/80 bg-raised text-left transition-[border-color] hover:border-muted/70"
    >
      <div className="aspect-video overflow-hidden bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.src} alt={item.alt} loading="lazy" className="block h-full w-full object-cover" />
      </div>
      <span className="flex min-h-11 items-center justify-between gap-2 border-t border-line/60 bg-surface/60 px-3 py-2">
        <span className="font-mono text-meta text-faint tnum">{item.year}</span>
        <span className="min-w-0 truncate text-meta text-muted transition-colors group-hover:text-ink">{item.alt}</span>
      </span>
    </button>
  )
}

function Lightbox({
  item,
  index,
  total,
  onClose,
  onPrev,
  onNext,
}: {
  item: GalleryItem
  index: number
  total: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const sourceHref = gallerySourceHref(item.source)

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null
    const prevScrollY = window.scrollY
    const prevBodyOverflow = document.body.style.overflow
    const prevScrollBehavior = document.documentElement.style.scrollBehavior
    // 先锁住背景滚动，再转移焦点；不要给 body 加 position: fixed，否则会影响灯箱自身的 fixed 定位。
    // 全局页面使用 smooth 滚动时，焦点切换会把恢复滚动延迟成一段动画，这里只在灯箱生命周期内临时关闭。
    document.documentElement.style.scrollBehavior = 'auto'
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus({ preventScroll: true })
    window.scrollTo(0, prevScrollY)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') onPrev()
      else if (e.key === 'ArrowRight') onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevBodyOverflow
      prevFocus?.focus({ preventScroll: true })
      window.scrollTo(0, prevScrollY)
      document.documentElement.style.scrollBehavior = prevScrollBehavior
    }
  }, [onClose, onPrev, onNext])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={item.alt}>
      <button aria-label="关闭" onClick={onClose} className="absolute inset-0 bg-base/92 backdrop-blur-sm" />
      <div className="ui-backdrop-in relative flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_40px_120px_rgba(0,0,0,0.6)] lg:flex-row">
        {/* 大图 */}
        <div className="flex min-h-0 flex-1 items-center justify-center bg-raised/60 p-3 sm:p-5">
          {sourceHref ? (
            <a
              href={sourceHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`打开原始视频：${item.alt}`}
              className="group/media relative flex max-h-full max-w-full cursor-pointer items-center justify-center rounded-lg focus-visible:outline-none"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.src} alt={item.alt} className="max-h-[52vh] w-auto max-w-full object-contain lg:max-h-[78vh]" />
              <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-base/80 px-3 py-1.5 text-meta text-ink opacity-0 shadow-lg backdrop-blur-sm transition-opacity group-hover/media:opacity-100 group-focus-visible/media:opacity-100">
                打开原始视频 ↗
              </span>
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.src} alt={item.alt} className="max-h-[52vh] w-auto max-w-full object-contain lg:max-h-[78vh]" />
          )}
        </div>
        {/* 图注 */}
        <div className="flex w-full shrink-0 flex-col gap-4 border-t border-line/70 p-5 lg:w-[320px] lg:border-l lg:border-t-0 lg:p-6">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-meta uppercase tracking-[0.16em] text-today">{item.year}</span>
            <span className="font-mono text-meta text-faint tnum">
              {index + 1} / {total}
            </span>
          </div>
          <h3 className="text-h3 font-semibold text-ink">{item.alt}</h3>
          <p className="font-mono text-meta text-faint tnum">{item.date} · {item.dimensions}</p>
          {item.caption && <p className="text-body text-muted">{item.caption}</p>}
          <div className="flex flex-wrap gap-2 text-meta">
            {sourceHref && (
              <a
                href={sourceHref}
                target="_blank"
                rel="noopener noreferrer"
                className="ui-press rounded-sm border border-line px-2 py-1 text-muted transition-colors hover:border-live/60 hover:text-live"
              >
                原始来源 ↗
              </a>
            )}
            <Link
              href={`/chronicle/?y=${item.year}`}
              className="ui-press rounded-sm border border-line px-2 py-1 text-muted transition-colors hover:border-live/60 hover:text-live"
            >
              {item.year} 年编年史 →
            </Link>
          </div>
          <div className="mt-auto flex items-center justify-between border-t border-line/60 pt-4">
            <button onClick={onPrev} className="ui-press rounded-sm px-2 py-2 text-meta text-muted transition-colors hover:text-ink sm:py-1.5">
              ← 上一张
            </button>
            <button ref={closeRef} onClick={onClose} className="ui-press rounded-sm px-2 py-2 text-meta text-muted transition-colors hover:text-ink sm:py-1.5">
              关闭 · Esc
            </button>
            <button onClick={onNext} className="ui-press rounded-sm px-2 py-2 text-meta text-muted transition-colors hover:text-ink sm:py-1.5">
              下一张 →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
