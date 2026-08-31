import Link from 'next/link'

/**
 * 三幕讲完之后的最后一屏：把「还能往哪儿走」交出去。
 *
 * 幕尾那句收束是故事的句号，但读者此刻正好处在最愿意继续翻的位置——
 * 与其让他们滚回顶部找导航，不如在这儿把两条主路摆出来：
 * 左边编年史（时间轴，按条读），右边画廊（画面，按年看）。
 * 两边都给一小块真实预览，不是两个空按钮。
 */
export type ExplorePromoData = {
  chronicle: {
    acts: { id: string; years: string; color: string }[]
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
        <span className="font-mono text-meta tracking-[0.2em] text-faint">NEXT · 接着往下看</span>
        <span className="h-px flex-1 bg-line/70" />
      </div>
      <div className={`mt-6 grid gap-4 sm:gap-6 lg:grid-cols-2 ${stage ? 'lg:gap-8' : ''}`}>
        {/* 编年史 */}
        <PromoCard
          href="/chronicle/"
          kicker="Chronicle · 编年史"
          title="一条一条地看下去。"
          body={`${data.chronicle.years} 年、${data.chronicle.entries.toLocaleString()} 条记录，按时间排好在那儿。`}
          cta="打开编年史 →"
          color="#5BC8E8"
        >
          {/* 只列三幕的年份带（本身已经带着那一段的说明），标题留给编年史页自己讲。
              手机端一行放得下，不用靠截断把话说半句。 */}
          <ul className="flex flex-col gap-2.5">
            {data.chronicle.acts.map((act) => (
              <li key={act.id} className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: act.color }} />
                <span className="min-w-0 font-mono text-meta tnum text-muted">{act.years}</span>
              </li>
            ))}
          </ul>
        </PromoCard>

        {/* 画廊 */}
        <PromoCard
          href="/gallery/"
          kicker="Gallery · 画廊"
          title="把这些年，一张张摊开。"
          body={`${data.gallery.featured} 张纪念节点，${data.gallery.total} 张全量影像${data.gallery.span ? `，跨 ${data.gallery.span}` : ''}。`}
          cta="进入画廊 →"
          color="#E5568A"
        >
          <div className="grid grid-cols-4 gap-1.5">
            {data.gallery.thumbs.slice(0, 8).map((photo) => (
              <span key={photo.id} className="aspect-square overflow-hidden rounded-[4px] bg-raised">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.src}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover opacity-80 transition duration-500 group-hover:opacity-100"
                />
              </span>
            ))}
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
  children,
}: {
  href: string
  kicker: string
  title: string
  body: string
  cta: string
  color: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="ui-press group flex flex-col gap-5 rounded-2xl border border-line/80 bg-surface/35 p-6 transition-colors hover:border-muted/60 sm:p-7"
    >
      <div>
        <p className="font-mono text-meta tracking-[0.16em]" style={{ color }}>{kicker}</p>
        <h3 className="mt-3 text-h3 font-semibold text-ink">{title}</h3>
        <p className="mt-2 text-control text-muted">{body}</p>
      </div>
      {children}
      <span className="mt-auto text-meta text-faint transition-colors group-hover:text-ink">{cta}</span>
    </Link>
  )
}
