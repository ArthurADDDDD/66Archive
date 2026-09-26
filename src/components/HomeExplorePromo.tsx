import Link from 'next/link'
import type { ReactNode } from 'react'
import { galleryThumbSources } from '@/lib/gallery-photos'
import { SiteText } from './SiteText'

/**
 * 三幕讲完之后的最后一屏：把「还能往哪儿走」交出去。
 *
 * 幕尾那句收束是故事的句号，但读者此刻正好处在最愿意继续翻的位置——
 * 与其让他们滚回顶部找导航，不如在这儿把两条主路摆出来：
 * 左边大事件（时间轴，按条读），右边画廊（画面，按年看）。
 * 两边都给一小块真实预览，不是两个空按钮。
 */
export type ExplorePromoData = {
  chronicle: {
    /** 大事件的三个时代，每段带三件代表性的事（首页构建期从故事基线里挑，见 app/page.tsx）。 */
    eras: {
      id: string
      label: string
      color: string
      years: string
      count: number
      events: { id: string; date: string; title: string }[]
    }[]
    entries: number
    years: number
  }
  gallery: {
    thumbs: { id: string; src: string }[]
    featured: number
    total: number
    span: string | null
  }
}

export function HomeExplorePromo({ data, variant = 'section' }: { data: ExplorePromoData; variant?: 'stage' | 'section' }) {
  const stage = variant === 'stage'
  return (
    <div className={stage ? 'w-full' : 'home-content-container px-page py-14 sm:py-20'}>
      <div className="flex items-center gap-4">
        <span className="font-mono text-meta tracking-[0.2em] text-faint"><SiteText id="home-outro-eyebrow" /></span>
        <span className="h-px flex-1 bg-line/70" />
      </div>
      {/* 舞台版从 md 起就并排：两张竖着叠在一张卡里放不下，会在卡内出现第二个滚动条。 */}
      <div className={`grid lg:grid-cols-2 ${stage ? 'mt-3 gap-2 sm:mt-6 sm:gap-6 md:grid-cols-2 lg:gap-8' : 'mt-6 gap-4 sm:gap-6'}`}>
        {/*
          编年史。body 原文是「N 年、N 条记录，按时间排好在那儿」——条数在这里
          不起任何作用：既不帮人决定要不要点进去，也不告诉人里面是什么。
        */}
        <PromoCard
          href="/chronicle/"
          kicker={<SiteText id="home-outro-chronicle-kicker" />}
          title={<SiteText id="home-outro-chronicle-title" />}
          body={<SiteText id="home-outro-chronicle-body" />}
          cta={<SiteText id="home-outro-chronicle-cta" />}
          color="#5BC8E8"
          compact={stage}
        >
          {/*
            一条缩小版的大事件时间轴：三个时代挂在同一条竖线上，每段列三件代表性的事。
            右边画廊有八张图，这边以前只有三行年份，左右一重一轻；现在两边的信息量对得上。
            舞台版在手机上只留时代这一行（事件行放不下，卡内不能出现第二层滚动）。
          */}
          <ol className={`relative border-l border-line/60 pl-4 ${stage ? 'space-y-2 sm:space-y-4' : 'space-y-4'}`}>
            {data.chronicle.eras.map((era) => (
              <li key={era.id} className="relative">
                <span
                  aria-hidden
                  className="absolute left-[calc(-1rem-0.5px)] top-[0.45em] h-2 w-2 -translate-x-1/2 rounded-full border-2 border-base"
                  style={{ background: era.color }}
                />
                <p className="flex flex-wrap items-baseline gap-x-2 text-meta">
                  <span className="font-medium" style={{ color: era.color }}>{era.label}</span>
                  <span className="font-mono text-faint tnum">{era.years}</span>
                  <span className="text-faint tnum">· {era.count} 件</span>
                </p>
                {era.events.length > 0 && (
                  <ul className={`mt-1.5 space-y-1 ${stage ? 'hidden sm:block' : ''}`}>
                    {era.events.map((event) => (
                      <li key={event.id} className="flex min-w-0 items-baseline gap-3 text-control">
                        <span className="w-[4.5em] shrink-0 font-mono text-meta text-faint tnum">{event.date}</span>
                        <span className="min-w-0 truncate text-ink/85 transition-colors group-hover:text-ink">{event.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </PromoCard>

        {/* 画廊 */}
        <PromoCard
          href="/gallery/"
          kicker={<SiteText id="home-outro-gallery-kicker" />}
          title={<SiteText id="home-outro-gallery-title" />}
          body={<SiteText id="home-outro-gallery-body" vars={{ span: data.gallery.span ?? '' }} />}
          cta={<SiteText id="home-outro-gallery-cta" />}
          color="#E5568A"
          compact={stage}
        >
          <div className="grid grid-cols-4 gap-1.5">
            {data.gallery.thumbs.slice(0, 8).map((photo, index) => {
              // 这八张显示成 ~70px 的方块，却一直在下 `.thumb.jpg` 原尺寸：
              // 实测八张合计 340,257 B，同一批 `.thumb-360.avif` 只要 54,532 B。
              // 变体文件构建时就已经生成、画廊页也早在用，这里只是没接上。
              const sources = galleryThumbSources(photo.src)
              return (
                <span key={photo.id} className={`aspect-square overflow-hidden rounded-[4px] bg-raised ${stage && index >= 4 ? 'hidden sm:block' : ''}`}>
                  <picture className="block h-full w-full">
                    {sources ? <source type="image/avif" srcSet={sources.avif} sizes="80px" /> : null}
                    {sources ? <source type="image/webp" srcSet={sources.webp} sizes="80px" /> : null}
                    <img
                      src={photo.src}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover opacity-80 transition duration-500 group-hover:opacity-100"
                    />
                  </picture>
                </span>
              )
            })}
          </div>
        </PromoCard>
      </div>
    </div>
  )
}

function PromoCard({
  href,
  kicker,
  title,
  body,
  cta,
  color,
  compact = false,
  children,
}: {
  href: string
  kicker: ReactNode
  title: ReactNode
  body: ReactNode
  cta: ReactNode
  color: string
  compact?: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={`ui-press group flex flex-col rounded-2xl border border-line/80 bg-surface/35 transition-colors hover:border-muted/60 ${compact ? 'gap-2 p-4 sm:gap-5 sm:p-7' : 'gap-5 p-6 sm:p-7'}`}
    >
      <div>
        <p className="font-mono text-meta tracking-[0.16em]" style={{ color }}>{kicker}</p>
        <h3 className={`${compact ? 'mt-2 sm:mt-3' : 'mt-3'} text-h3 font-semibold text-ink`}>{title}</h3>
        <p className={`${compact ? 'mt-1 sm:mt-2' : 'mt-2'} text-control text-muted`}>{body}</p>
      </div>
      {children}
      <span className="mt-auto text-meta text-faint transition-colors group-hover:text-ink">{cta}</span>
    </Link>
  )
}
