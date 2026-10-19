'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { collectionTimestamp, parseCollectionLogPage, type CollectionLogItem } from '@/lib/collection-log'
import { UpdateLogFrame } from './UpdateLogFrame'
import { UpdateCopy } from './UpdateCopy'

const CONTENT_ORIGIN = (process.env.NEXT_PUBLIC_CONTENT_ORIGIN ?? '').replace(/\/$/, '')
const LABELS = { live: '录播', video: '视频', gallery: '画廊' }

export function CollectionLog({ history }: { history: readonly { date: string; title: string; text: string }[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pending = useRef(false)
  const mounted = useRef(false)
  const [items, setItems] = useState<CollectionLogItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (cursor: string | null = null) => {
    if (pending.current) return
    pending.current = true
    setLoading(true)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
      const response = await fetch(`${CONTENT_ORIGIN}/api/content/collection-log${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { signal: controller.signal, credentials: 'omit' })
      const page = response.ok ? parseCollectionLogPage(await response.json()) : null
      if (!page) throw new Error('unavailable')
      if (!mounted.current) return
      setItems((previous) => cursor ? [...previous, ...page.items.filter((item) => !previous.some((old) => old.id === item.id && old.type === item.type))] : page.items)
      setNextCursor(page.nextCursor)
      setLoaded(true)
      setFailed(false)
    } catch {
      if (mounted.current) setFailed(true)
    } finally {
      clearTimeout(timeout)
      pending.current = false
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    let visible = false
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) void load()
    }, { rootMargin: '200px' })
    if (scrollRef.current) observer.observe(scrollRef.current)
    const timer = setInterval(() => {
      if (visible && !document.hidden && (scrollRef.current?.scrollTop ?? 0) < 16) void load()
    }, 60_000)
    return () => { mounted.current = false; observer.disconnect(); clearInterval(timer) }
  }, [load])

  const older = () => { if (nextCursor) void load(nextCursor) }
  return (
    <UpdateLogFrame
      id="archive-updates" title="收录日志" scrollRef={scrollRef}
      note="自动记录新增视频、录播与画廊素材。时间戳为首次收录确认时间（北京时间），不是直播或投稿发生时间。"
      onScroll={() => {
        const box = scrollRef.current
        if (box && box.scrollHeight - box.scrollTop - box.clientHeight < 80) older()
      }}
    >
      <ol className="divide-y divide-line/50">
        {items.map((item) => (
          <li key={`${item.type}:${item.id}`} className="py-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <time dateTime={item.recordedAt} className="font-mono text-meta text-faint tnum">{collectionTimestamp(item.recordedAt)}</time>
              <span className="text-meta text-faint">新增{LABELS[item.type]}</span>
            </div>
            <Link href={item.href} prefetch={false} className="mt-1 block text-body text-muted hover:text-ink">{item.title}</Link>
            {item.contentDate && <p className="mt-1 text-meta text-faint">{item.type === 'live' ? '直播日期' : '内容日期'} · {item.contentDate}</p>}
          </li>
        ))}
      </ol>
      {failed && <p role="status" className="py-3 text-meta text-faint">收录日志暂时无法更新。<button type="button" onClick={() => void load(nextCursor)} className="ml-2 min-h-11 underline underline-offset-4">重试</button></p>}
      {nextCursor && <button type="button" disabled={loading} onClick={older} className="min-h-11 w-full py-3 text-meta text-muted hover:text-ink disabled:opacity-50">{loading ? '加载中…' : '查看更早收录 ↓'}</button>}
      {(!loaded || !nextCursor) && (
        <div>
          <p className="border-t border-line/50 py-3 text-meta text-faint">早期收录摘要 · 仅保留已核对的日期</p>
          <ol className="divide-y divide-line/50">
            {history.map((update) => <li key={`${update.date}-${update.title}`} className="py-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <time dateTime={update.date} className="font-mono text-meta text-faint tnum">{update.date.replaceAll('-', '.')}</time>
                <h3 className="text-body font-medium text-muted"><UpdateCopy category="archive" entry={update} field="title" /></h3>
              </div>
              <p className="mt-1 text-body text-muted"><UpdateCopy category="archive" entry={update} field="text" /></p>
            </li>)}
          </ol>
        </div>
      )}
    </UpdateLogFrame>
  )
}
