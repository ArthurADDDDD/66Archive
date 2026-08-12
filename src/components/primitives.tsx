'use client'

import { useState } from 'react'
import Link from 'next/link'

/**
 * 全站共享 Primitive。六个页面共用同一套字排与间距，
 * 页面人格只发生在这些原语之上的组合方式里。
 * 刻意不抽象成 <Card/>——每个房间的观看方式不同。
 */

export function Container({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1240px] px-4 sm:px-6 ${className}`}>{children}</div>
}

/** mono 小眉标：可带色点 / 颜色 */
export function Eyebrow({
  children,
  color,
  dot,
  className = '',
}: {
  children: React.ReactNode
  color?: string
  dot?: boolean
  className?: string
}) {
  return (
    <p className={`flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] ${className}`} style={color ? { color } : undefined}>
      {dot && <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: color ?? '#8B8FA3' }} />}
      {children}
    </p>
  )
}

/** 页面头部：眉标 + 大标题 + 一句引导（可选右侧插槽） */
export function PageHeader({
  eyebrow,
  eyebrowColor,
  title,
  lede,
  right,
}: {
  eyebrow: string
  eyebrowColor?: string
  title: React.ReactNode
  lede?: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
      <div className="max-w-3xl">
        <Eyebrow color={eyebrowColor}>{eyebrow}</Eyebrow>
        <h1 className="mt-4 text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[46px]">{title}</h1>
        {lede && <div className="mt-5 max-w-2xl text-[13px] leading-7 text-muted">{lede}</div>}
      </div>
      {right}
    </div>
  )
}

/** 章节标题：眉标 + 二级标题 + 可选正文 */
export function SectionHeading({
  eyebrow,
  eyebrowColor,
  title,
  body,
  className = '',
}: {
  eyebrow?: string
  eyebrowColor?: string
  title: React.ReactNode
  body?: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      {eyebrow && <Eyebrow color={eyebrowColor}>{eyebrow}</Eyebrow>}
      <h2 className="mt-3 text-[22px] font-semibold leading-snug tracking-tight text-ink sm:text-[28px]">{title}</h2>
      {body && <div className="mt-3 max-w-2xl text-[13px] leading-7 text-muted">{body}</div>}
    </div>
  )
}

/** 视觉框：真实封面，缺失或加载失败（onError）时退化为字排版色块（绝不用假图） */
export function MediaFrame({
  src,
  alt = '',
  fallback,
  aspect = 'aspect-video',
  className = '',
  children,
}: {
  src?: string | null
  alt?: string
  fallback?: React.ReactNode
  aspect?: string
  className?: string
  children?: React.ReactNode
}) {
  const [broken, setBroken] = useState(false)
  const showImage = Boolean(src) && !broken
  return (
    <div className={`relative ${aspect} overflow-hidden rounded-xl border border-line/80 bg-raised ${className}`}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-video/12 via-raised to-live/8 p-6">
          {fallback ?? <span className="font-mono text-[11px] tracking-widest text-faint/70">封面待补</span>}
        </div>
      )}
      {children}
    </div>
  )
}

/** 引语：真实内容的一句话，承担情绪 */
export function StoryQuote({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <blockquote className="border-l-2 pl-5" style={{ borderColor: color ?? '#5A5F73' }}>
      <p className="font-display text-[20px] font-medium leading-relaxed tracking-tight text-ink sm:text-[24px]">{children}</p>
    </blockquote>
  )
}

/** 档案行：日期 + 标题 + 右侧元信息，用于可列表化的内容。
 * 移动端：触控行高 ≥44px、长标题换行（不截断隐藏内容）；桌面保持截断与原样。 */
export function ArchiveRow({
  href,
  date,
  title,
  meta,
  right,
  accent,
}: {
  href: string
  date: string
  title: React.ReactNode
  meta?: React.ReactNode
  right?: React.ReactNode
  accent?: string
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[44px] items-start gap-3 py-3 transition-colors hover:bg-surface/30 sm:min-h-0 sm:items-baseline"
    >
      <span className="w-[84px] shrink-0 font-mono text-[11px] text-faint tnum sm:w-[104px]">{date}</span>
      <span className="min-w-0 flex-1 text-[13px] leading-6 text-muted group-hover:text-ink sm:truncate sm:leading-normal">
        {title}
      </span>
      {meta && <span className="shrink-0 font-mono text-[10px] text-faint/70 tnum">{meta}</span>}
      {right ?? (
        <span className="shrink-0 font-mono text-[11px] text-faint/50 transition-transform group-hover:translate-x-1" style={accent ? { color: accent } : undefined}>
          →
        </span>
      )}
    </Link>
  )
}

/** 来源行内元信息（来源计数） */
export function SourceCount({ count }: { count: number }) {
  return count > 0 ? (
    <span className="font-mono text-[10px] text-faint/70 tnum">{count} 个来源</span>
  ) : (
    <span className="font-mono text-[10px] text-faint/50 tnum">来源待补</span>
  )
}
