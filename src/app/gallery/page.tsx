import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { BackToTop, MobileQuickNav } from '@/components/ScrollAffordances'
import { SiteFooter } from '@/components/primitives'
import { LivePageHeading } from '@/components/LiveSection'

/**
 * Gallery 暂时作为档案征集页公开保留。
 * GalleryView、gallery.ts、gallery-assets.yaml 与现有图片都不动；资料收齐后只需把旧视图接回这里。
 */
export default function GalleryPage() {
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

      <section className="site-container px-page pb-24 pt-12 sm:pb-32 sm:pt-20">
        <div className="pointer-events-none absolute -right-20 -top-24 h-[220px] w-[220px] rounded-full bg-today/10 blur-[60px] sm:h-[380px] sm:w-[380px] sm:blur-[110px]" />
        <div className="relative max-w-[760px]">
          <LivePageHeading pageId="gallery" eyebrowColor="#E5568A" className="ui-reveal" />
          <div className="ui-reveal mt-8 space-y-5 text-body leading-relaxed text-muted sm:text-[18px]">
            <p>这些年留下过很多周年贺图、生日作品、水友创作和直播间里的纪念画面。</p>
            <p>其中一些如今只剩预览图、转发记录，或者已经失效的原始链接。</p>
            <p>与其先用不完整的素材把这里填满，我更希望等它们被确认、找到原图，再好好放进来。</p>
            <p>如果你手里还保存着这些年的周年图片、各部祝福、生日作品、老截图，或者知道它们最早的出处，欢迎把线索发给我。</p>
          </div>
          <p className="ui-reveal mt-8 border-l-2 border-today/70 py-1 pl-5 text-body font-medium text-ink">
            如果能同时提供年份、作者、原图或原始链接，会特别有帮助。
          </p>
          <p className="ui-reveal mt-8 text-body text-muted">每补回来一份，这里就更接近当年的样子。</p>
          <Link href="/contact/" className="ui-press ui-reveal mt-8 inline-block rounded-sm text-body font-medium text-today underline decoration-today/50 underline-offset-8 hover:text-ink">
            提供线索 →
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
