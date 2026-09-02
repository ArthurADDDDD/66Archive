import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { BackToTop, MobileQuickNav } from '@/components/ScrollAffordances'
import { SiteFooter } from '@/components/primitives'
import { LivePageHeading } from '@/components/LiveSection'
import { GalleryLiveBoard } from '@/components/GalleryLiveBoard'
import { getGalleryCollections } from '@/lib/gallery-photos-manifest'

/** 画廊：精选节点与全量年份底片架共用一套发布版浏览体验。 */
export default function GalleryPage() {
  const collections = getGalleryCollections()
  const years = [...new Set(collections.all.map((p) => p.year).filter((y): y is string => y !== null))].sort()

  return (
    <main className="ui-page-in min-h-screen overflow-x-clip">
      <MobileQuickNav active="gallery" />
      <BackToTop />
      <header className="ui-slide-down relative z-20 site-header-container flex items-center justify-between px-page py-5">
        <SiteNav active="gallery" />
        <Link href="/chronicle/" className="ui-press hidden whitespace-nowrap rounded-sm text-meta text-live lg:block">
          去编年史 →
        </Link>
      </header>

      <section className="site-container-wide px-page pb-10 pt-10 sm:pt-16">
        <div className="pointer-events-none absolute -right-20 -top-24 h-[220px] w-[220px] rounded-full bg-today/10 blur-[60px] sm:h-[380px] sm:w-[380px] sm:blur-[110px]" />
        <div className="relative measure-body">
          <LivePageHeading pageId="gallery" eyebrowColor="#E5568A" className="ui-reveal" />
          {collections.all.length > 0 && (
            <p className="ui-reveal mt-6 text-body text-muted tnum">
              {collections.featured.length} 张纪念节点，{collections.all.length} 张全量影像，跨 {years[0]}–{years[years.length - 1]} 年。
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
          <h2 className="text-h3 font-semibold text-ink">还在找这些</h2>
          <div className="mt-5 space-y-4 text-body leading-relaxed text-muted">
            <p>这些年留下过很多周年贺图、生日作品、水友创作和直播间里的纪念画面。其中一些如今只剩预览图、转发记录，或者已经失效的原始链接。</p>
            <p>如果你手里还保存着这些年的周年图片、各部祝福、生日作品、老截图，或者知道它们最早的出处，欢迎把线索发给我。</p>
          </div>
          <p className="mt-6 border-l-2 border-today/70 py-1 pl-5 text-body font-medium text-ink">
            如果能同时提供年份、作者、原图或原始链接，会特别有帮助。
          </p>
          <Link href="/contact/" className="ui-press mt-6 inline-block rounded-sm text-body font-medium text-today underline decoration-today/50 underline-offset-8 hover:text-ink">
            提供线索 →
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
