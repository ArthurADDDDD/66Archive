'use client'

import Link from 'next/link'
import { Eyebrow, PageHeader } from './primitives'
import { useCopyBlock, useSectionEnabled, useSiteCopy } from './LiveContentProvider'

/**
 * 首页区块的头部（小标 / 标题 / 引子）与房间入口卡。
 *
 * 这些文案由后台「站点文案」控制，板块的显示与否由后台「板块管理」控制。
 * 都是客户端组件：静态站的 HTML 里是构建期基线，覆盖在浏览器里打上去，
 * 后台不可用时页面原样保持基线，不会空。
 */

/** 板块开关：后台把某个板块停用后，整块从首页消失。 */
export function LiveSectionGate({ sectionId, children }: { sectionId: string; children: React.ReactNode }) {
  return useSectionEnabled(sectionId) ? <>{children}</> : null
}

export function LiveSectionHeading({
  sectionId,
  eyebrowColor,
  titleClassName = 'mt-3 text-h2 font-semibold text-ink',
}: {
  sectionId: string
  eyebrowColor?: string
  titleClassName?: string
}) {
  const block = useCopyBlock('homeSections', sectionId)
  return (
    <>
      {block.eyebrow && <Eyebrow color={eyebrowColor}>{block.eyebrow}</Eyebrow>}
      {block.title && <h2 className={titleClassName}>{block.title}</h2>}
      {block.lede && <p className="measure-body mt-3 text-body text-muted">{block.lede}</p>}
    </>
  )
}

/** 子页页头：版式仍然是 PageHeader，文字换成后台「站点文案 · 子页页头」的当前值。 */
export function LivePageHeader({
  pageId,
  eyebrowColor,
  right,
  wide,
}: {
  pageId: string
  eyebrowColor?: string
  right?: React.ReactNode
  wide?: boolean
}) {
  const block = useCopyBlock('pages', pageId)
  return <PageHeader eyebrow={block.eyebrow} eyebrowColor={eyebrowColor} title={block.title} lede={block.lede} right={right} wide={wide} />
}

/** 只有小标 / 标题 / 引子的轻量页头（画廊、游戏这类自带版式的页面用）。 */
export function LivePageHeading({
  pageId,
  eyebrowColor,
  titleClassName = 'measure-hero mt-4 text-h1 font-semibold',
  className,
}: {
  pageId: string
  eyebrowColor?: string
  titleClassName?: string
  className?: string
}) {
  const block = useCopyBlock('pages', pageId)
  return (
    <div className={className}>
      {block.eyebrow && <Eyebrow color={eyebrowColor}>{block.eyebrow}</Eyebrow>}
      {block.title && <h1 className={titleClassName}>{block.title}</h1>}
      {block.lede && <p className="measure-body mt-5 text-body text-muted">{block.lede}</p>}
    </div>
  )
}

/**
 * 多段引子的页头。
 *
 * 与 `LivePageHeading` 的差别只有一处：`lede` 按换行分段渲染成多个 `<p>`。
 * 「这个站为什么存在」这类文字一段说不完，而挤成一整块的长段落没人会读完。
 * 分段仍然是一个可编辑字段——在文案里换行就是换段，不需要为每一段单独建一项。
 */
export function LivePageIntro({
  pageId,
  eyebrowColor,
  heading = 'h1',
  titleClassName = 'measure-hero mt-4 text-h1 font-semibold',
  className,
}: {
  pageId: string
  eyebrowColor?: string
  /** 一页只能有一个 h1；同一页里的第二块用 h2。 */
  heading?: 'h1' | 'h2'
  titleClassName?: string
  className?: string
}) {
  const block = useCopyBlock('pages', pageId)
  const Heading = heading
  const paragraphs = block.lede.split('\n').map((line) => line.trim()).filter((line) => line.length > 0)
  return (
    <div className={className}>
      {block.eyebrow && <Eyebrow color={eyebrowColor}>{block.eyebrow}</Eyebrow>}
      {block.title && <Heading className={titleClassName}>{block.title}</Heading>}
      {paragraphs.map((paragraph, index) => (
        <p key={paragraph.slice(0, 24)} className={`measure-body text-body text-muted ${index === 0 ? 'mt-6' : 'mt-4'}`}>
          {paragraph}
        </p>
      ))}
    </div>
  )
}

const ROOM_HREF: Record<string, string> = {
  chronicle: '/chronicle/',
  series: '/series/',
  stats: '/stats/',
  gallery: '/gallery/',
  games: '/games/',
}

const ROOM_COLOR: Record<string, string> = {
  chronicle: '#5BC8E8',
  series: '#A78BFA',
  stats: '#E5568A',
  gallery: '#FF6B75',
  games: '#E0A244',
}

/**
 * 四个房间。文案跟着后台走；去哪个页面和配色是版式，写死在这里——
 * 后台改错一个地址就是一个 404，那不是值得开放的自由度。
 */
export function LiveRooms() {
  const copy = useSiteCopy()
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {copy.rooms.map((room) => {
        const href = ROOM_HREF[room.id]
        if (!href) return null
        return (
          <Link
            key={room.id}
            href={href}
            className="ui-press group rounded-2xl border border-line bg-surface/25 p-6 transition-colors hover:border-muted/70 hover:bg-surface/45"
          >
            <span className="text-meta uppercase tracking-[0.16em]" style={{ color: ROOM_COLOR[room.id] ?? '#E6E4EF' }}>
              {room.kicker}
            </span>
            <span className="mt-3 block text-h3 font-semibold text-ink">{room.title}</span>
            <span className="mt-2 block text-meta leading-relaxed text-muted">{room.body}</span>
          </Link>
        )
      })}
    </div>
  )
}
