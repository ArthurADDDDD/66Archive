'use client'

import { useState } from 'react'
import Link from 'next/link'

/**
 * 全站共享 Primitive。六个页面共用同一套字排与间距，
 * 页面人格只发生在这些原语之上的组合方式里。
 * 刻意不抽象成 <Card/>——每个房间的观看方式不同。
 *
 * 两条排版硬规则（改动于「前端显示优化」）：
 * 1. font-mono 只用于纯数字 / 日期 / 拉丁字母。IBM Plex Mono 没有中文字形，
 *    带中文的 mono 小字实际掉到系统字体渲染，手机上又小又糊、基线还和数字对不齐。
 *    含中文的 meta 一律走正文字体 + tnum。
 * 2. 字号走 tailwind 的六档字阶（hero/h1/h2/h3/body/meta），不再写 text-[Npx] sm:text-[Mpx]。
 */

export function Container({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`site-container px-page ${className}`}>{children}</div>
}

/** 眉标：中英混排，所以字距只加在拉丁部分——中文被 tracking 拉散会更难读。 */
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
    <p className={`flex items-center gap-2 text-meta uppercase tracking-[0.16em] ${className}`} style={color ? { color } : undefined}>
      {dot && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color ?? '#9AA0B4' }} />}
      {children}
    </p>
  )
}

/**
 * meta 行：日期 / 时长 / 计数一类的次要信息。
 * mono 只在内容是纯数字或拉丁字母时才开（`mono` 属性），含中文时走正文字体。
 */
export function Meta({
  children,
  mono = false,
  className = '',
}: {
  children: React.ReactNode
  mono?: boolean
  className?: string
}) {
  return <p className={`text-meta tnum ${mono ? 'font-mono' : ''} text-faint ${className}`}>{children}</p>
}

/** 页面头部：眉标 + 大标题 + 一句引导（可选右侧插槽） */
export function PageHeader({
  eyebrow,
  eyebrowColor,
  title,
  lede,
  right,
  wide = false,
}: {
  eyebrow: string
  eyebrowColor?: string
  title: React.ReactNode
  lede?: React.ReactNode
  right?: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
      <div className={wide ? 'max-w-[min(100%,72rem)]' : 'max-w-3xl'}>
        <Eyebrow color={eyebrowColor}>{eyebrow}</Eyebrow>
        <h1 className={`mt-4 font-semibold text-ink ${wide ? 'text-[clamp(2.25rem,4.2vw,5rem)] leading-[1.08] tracking-[-0.025em]' : 'text-h1'}`}>{title}</h1>
        {lede && <div className={`mt-5 text-body text-muted ${wide ? 'max-w-3xl' : 'max-w-2xl'}`}>{lede}</div>}
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
      <h2 className="mt-3 text-h2 font-semibold text-ink">{title}</h2>
      {body && <div className="mt-3 max-w-2xl text-body text-muted">{body}</div>}
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
          {fallback ?? <span className="text-meta tracking-widest text-faint">封面待补</span>}
        </div>
      )}
      {children}
    </div>
  )
}

/** 引语：真实内容的一句话，承担情绪 */
export function StoryQuote({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <blockquote className="border-l-2 pl-5" style={{ borderColor: color ?? '#7C8296' }}>
      <p className="text-h3 font-medium leading-relaxed text-ink">{children}</p>
    </blockquote>
  )
}

/** 档案行：日期 + 标题 + 右侧元信息，用于可列表化的内容。
 * 移动端：第一行是「日期 · 时长 · 来源」的 meta 行，第二行是标题——
 * 标题永远从 x=0 开始，不会因为前面有没有小标签而左右浮动，整列读下来是齐的。
 * 桌面端（sm+）order 全部归零，回到原来的单行截断排布，逐像素不变。 */
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
      className="group flex min-h-[44px] flex-wrap items-baseline gap-x-3 gap-y-1 py-3 transition-colors hover:bg-surface/30 sm:flex-nowrap"
    >
      <span className="order-1 shrink-0 font-mono text-meta text-faint tnum sm:order-none sm:w-[104px]">{date}</span>
      <span className="order-3 w-full min-w-0 text-body text-muted group-hover:text-ink sm:order-none sm:w-auto sm:flex-1 sm:truncate">
        {title}
      </span>
      {meta && <span className="order-2 shrink-0 text-meta text-faint tnum sm:order-none">{meta}</span>}
      {right ?? (
        <span
          aria-hidden
          className="order-2 ml-auto shrink-0 font-mono text-meta text-faint/60 transition-transform group-hover:translate-x-1 sm:order-none sm:ml-0"
          style={accent ? { color: accent } : undefined}
        >
          →
        </span>
      )}
    </Link>
  )
}

/** 全站页脚。六个页面原本各写一份同样的 markup，这里收成一处，
 * 顺便把手机端点击热区补到 44px（视觉不变，靠负 margin 抵消）。 */
export function SiteFooter() {
  return (
    <footer
      className="site-container flex flex-col justify-between gap-4 px-page py-10 text-meta text-faint sm:flex-row"
    >
      <span>只索引，不搬运 · 所有播放回到原平台</span>
      <Link href="/contact/" className="ui-press -my-2 rounded-sm py-2 transition-colors hover:text-live">
        资料纠错与联系 →
      </Link>
    </footer>
  )
}

/** 来源行内元信息（来源计数） */
export function SourceCount({ count }: { count: number }) {
  return count > 0 ? (
    <span className="text-meta text-faint tnum">{count} 个来源</span>
  ) : (
    <span className="text-meta text-faint">来源待补</span>
  )
}
