import { fetchBakedPageCopy } from '@/lib/baked-content'
import { LiveCopySeed } from '@/components/LiveCopySeed'
import { SiteText, SiteTextParagraphs } from '@/components/SiteText'
import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/page-metadata'
import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { BackToTop, MobileQuickNav } from '@/components/ScrollAffordances'
import { SiteFooter } from '@/components/primitives'
import { LivePageHeading } from '@/components/LiveSection'
import { GalleryLiveBoard } from '@/components/GalleryLiveBoard'
import { getGalleryCollections } from '@/lib/gallery-photos-manifest'

/** 标题、简介、canonical 与社交卡片都由 `pageMetadata()` 一次给齐（见该文件注释）。 */
export const metadata: Metadata = pageMetadata({
  path: '/gallery/',
  title: '纪念画廊',
  description: '从屏风时代到现在，直播间里那些值得纪念的画面。',
})

/** 画廊：精选节点与全量年份底片架共用一套发布版浏览体验。 */
export default async function GalleryPage() {
  // 根 layout 只烤 {site, nav}（见 baked-content.ts 的 fetchBakedNavShell）。
  // 这一页真的会渲染后台文案，所以在这里把它需要的那份补回来。
  const bakedCopy = await fetchBakedPageCopy(['gallery'], { texts: ['gallery-'] })

  const collections = getGalleryCollections()
  const years = [...new Set(collections.all.map((p) => p.year).filter((y): y is string => y !== null))].sort()

  return (
    <LiveCopySeed copy={bakedCopy}>
      <main className="ui-page-in min-h-screen overflow-x-clip">
        <MobileQuickNav active="gallery" />
        <BackToTop />
        <header className="ui-slide-down relative z-20 site-header-container flex items-center justify-between px-page py-5">
          <SiteNav active="gallery" />
          <Link prefetch={false} href="/chronicle/" className="ui-press hidden whitespace-nowrap rounded-sm text-meta text-live lg:block">
            <SiteText id="gallery-chronicle-link" />
          </Link>
        </header>

        <section className="site-container-wide px-page pb-10 pt-10 sm:pt-16">
          <div className="pointer-events-none absolute -right-20 -top-24 h-[220px] w-[220px] rounded-full bg-today/10 blur-[60px] sm:h-[380px] sm:w-[380px] sm:blur-[110px]" />
          <div className="relative measure-body">
            <LivePageHeading pageId="gallery" eyebrowColor="#E5568A" className="ui-reveal" />
            {collections.all.length > 0 && (
              <p className="ui-reveal mt-6 text-body text-muted tnum">
                <SiteText
                  id="gallery-summary"
                  vars={{ featured: collections.featured.length, all: collections.all.length, from: years[0], to: years[years.length - 1] }}
                />
              </p>
            )}
          </div>
        </section>

        {collections.all.length > 0 && (
          <section className="site-container-wide px-page pb-20">
            <GalleryLiveBoard featuredPhotos={collections.featured} allPhotos={collections.all} />
          </section>
        )}

        {/* 征集：素材没收齐这件事本身要说清楚，不能因为上面有图了就藏起来。 */}
        <section className="site-container px-page pb-24 sm:pb-32">
          <div className="measure-body border-t border-line/70 pt-10">
            <h2 className="text-h3 font-semibold text-ink"><SiteText id="gallery-wanted-title" /></h2>
            <div className="mt-5 space-y-4 text-body leading-relaxed text-muted">
              <SiteTextParagraphs id="gallery-wanted-body" />
            </div>
            <p className="mt-6 border-l-2 border-today/70 py-1 pl-5 text-body font-medium text-ink">
              <SiteText id="gallery-wanted-note" />
            </p>
            <Link prefetch={false} href="/contact/" className="ui-press mt-6 inline-block rounded-sm text-body font-medium text-today underline decoration-today/50 underline-offset-8 hover:text-ink">
              <SiteText id="gallery-wanted-cta" />
            </Link>
          </div>
        </section>

        <SiteFooter />
      </main>
    </LiveCopySeed>
  )
}
