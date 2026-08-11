import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { gallerySourceHref, getGalleryCollection, type GalleryItem } from '@/lib/gallery'

function groupByYear(items: GalleryItem[]) {
  return items.reduce<Map<string, GalleryItem[]>>((groups, item) => {
    const current = groups.get(item.year) ?? []
    current.push(item)
    groups.set(item.year, current)
    return groups
  }, new Map())
}

export default function GalleryPage() {
  const { items, gaps } = getGalleryCollection()
  const groups = groupByYear(items)
  const years = [...groups.keys()].sort()

  return (
    <main className="ui-page-in min-h-screen overflow-hidden">
      <header className="ui-slide-down relative z-20 mx-auto flex max-w-[1240px] items-center px-4 py-5 sm:px-6">
        <SiteNav active="gallery" />
      </header>

      <section className="relative mx-auto max-w-[1240px] px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
        <div className="pointer-events-none absolute -right-20 -top-32 h-[420px] w-[420px] rounded-full bg-today/10 blur-[110px]" />
        <div className="ui-reveal relative grid gap-10 lg:grid-cols-[1fr_360px] lg:items-end">
          <div className="max-w-3xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-today">Gallery · Annual gifts</p>
            <h1 className="mt-4 text-[42px] font-semibold leading-[1.08] tracking-tight sm:text-[64px]">
              被画下来的几年。
            </h1>
            <p className="mt-6 max-w-2xl text-[14px] leading-8 text-muted">
              这些画面不是装饰，而是水友替每一个年份留下的注脚。按时间打开它们，能看见直播间如何从一场周年纪念，慢慢长成一条有人陪伴的路。
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 border-y border-line py-4 font-mono text-[10px] text-faint">
            <div>
              <span className="block font-display text-2xl font-bold text-ink">{items.length}</span>
              <span className="mt-1 block">已收录画面</span>
            </div>
            <div>
              <span className="block font-display text-2xl font-bold text-ink">{years.length}</span>
              <span className="mt-1 block">出现年份</span>
            </div>
            <div>
              <span className="block font-display text-2xl font-bold text-ink">{gaps.length}</span>
              <span className="mt-1 block">待补年份</span>
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-[1240px] px-4 pb-24 sm:px-6">
        <div className="absolute bottom-0 left-[calc(1rem+16px)] top-0 w-px bg-line sm:left-[calc(1.5rem+20px)] lg:left-[calc(50%-420px)]" />
        <div className="relative space-y-16 sm:space-y-24">
          {years.map((year, yearIndex) => {
            const yearItems = groups.get(year) ?? []
            return (
              <section key={year} id={`gallery-${year}`} className="relative grid gap-6 pl-12 sm:pl-16 lg:grid-cols-[210px_1fr] lg:gap-10 lg:pl-0">
                <div className="relative lg:pt-2">
                  <span className="absolute -left-[calc(3rem+5px)] top-1.5 h-3 w-3 rounded-full border-2 border-base bg-live shadow-[0_0_0_4px_rgba(91,200,232,0.14)] transition-[box-shadow,transform] duration-300 hover:scale-125 hover:shadow-[0_0_0_7px_rgba(91,200,232,0.12)] sm:-left-[calc(4rem+5px)] lg:left-auto lg:right-[-25px]">
                    
                  </span>
                  <p className="font-display text-[48px] font-bold leading-none tracking-[-0.06em] text-ink sm:text-[68px]">{year}</p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-live">
                    {yearIndex === 0 ? '从这里开始' : '时间切片'} · {yearItems.length} 份
                  </p>
                </div>

                <div className="columns-1 gap-5 sm:columns-2">
                  {yearItems.map((item, itemIndex) => (
                    <GalleryCard key={item.id} item={item} featured={yearIndex === 0 && itemIndex === 0} />
                  ))}
                </div>
              </section>
            )
          })}

          <section className="relative pl-12 sm:pl-16 lg:pl-[250px]">
            <span className="absolute -left-[calc(3rem+1px)] top-0 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-base font-mono text-[10px] text-faint sm:-left-[calc(4rem+1px)] lg:left-[calc(210px-25px)]">
              ···
            </span>
            <div className="ui-card rounded-2xl border border-dashed border-line bg-surface/25 p-5 hover:border-muted sm:p-7">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Missing chapters</p>
              <h2 className="mt-3 text-[24px] font-medium tracking-tight text-ink">还有一些年份，正在等待被找回。</h2>
              <p className="mt-3 max-w-2xl text-[13px] leading-7 text-muted">
                缺口不是空白页，而是下一次补录的方向。以下年份目前没有找到可公开核验的独立周年记录；如果你手上有原图、视频或帖子线索，欢迎从这里补上。
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {gaps.map((gap) => (
                  <span key={gap.years ?? gap.item} className="rounded-full border border-line px-3 py-1.5 font-mono text-[10px] text-faint">
                    {gap.years ?? gap.item}
                  </span>
                ))}
              </div>
              <Link href="/contact/" className="ui-press mt-6 inline-block rounded-sm font-mono text-[11px] text-live underline underline-offset-4">
                提供画作线索 →
              </Link>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

function GalleryCard({ item, featured }: { item: GalleryItem; featured: boolean }) {
  const sourceHref = gallerySourceHref(item.source)

  return (
    <figure className={`ui-card mb-5 break-inside-avoid overflow-hidden rounded-2xl border border-line bg-surface/55 shadow-[0_14px_40px_rgba(0,0,0,0.12)] hover:border-muted ${featured ? 'sm:break-before-avoid' : ''}`}>
      <div className="group relative overflow-hidden bg-raised">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.src} alt={item.alt} loading="lazy" className="block w-full transition duration-500 group-hover:scale-[1.025]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="absolute left-3 top-3 rounded-full border border-white/25 bg-black/35 px-2 py-1 font-mono text-[9px] text-white/80 backdrop-blur-sm">
          {item.date}
        </span>
      </div>
      <figcaption className="p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="text-[14px] font-medium leading-snug text-ink">{item.alt}</h3>
          <span className="font-mono text-[9px] text-faint">{item.dimensions}</span>
        </div>
        <p className="mt-2 text-[12px] leading-6 text-muted">{item.caption}</p>
        <p className="mt-3 border-t border-line pt-3 font-mono text-[9px] leading-5 text-faint">
          {sourceHref ? (
            <a href={sourceHref} target="_blank" rel="noopener noreferrer" className="ui-press inline-block rounded-sm transition-colors hover:text-live">
              来源 · {item.source} ↗
            </a>
          ) : (
            <>来源 · {item.source}</>
          )}
        </p>
      </figcaption>
    </figure>
  )
}
