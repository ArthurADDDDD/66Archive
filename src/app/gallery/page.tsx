import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { BackToTop, MobileQuickNav } from '@/components/ScrollAffordances'
import { GalleryView } from '@/components/GalleryView'
import { getGalleryCollection } from '@/lib/gallery'
import { Eyebrow, SiteFooter } from '@/components/primitives'

/**
 * 记忆画廊：画面优先的 memory box。
 * 图片是主体，图注收进灯箱；顶部一句话说明这些画面是什么，数字只做脚注。
 * 低清图原样展示（不做超分修复）；缺口以「Missing chapters」诚实保留并指向补录入口。
 */
export default function GalleryPage() {
  const { items, gaps } = getGalleryCollection()
  const years = new Set(items.map((i) => i.year))

  return (
    <main className="ui-page-in min-h-screen overflow-x-clip">
      <MobileQuickNav active="gallery" />
      <BackToTop />
      <header className="ui-slide-down relative z-20 mx-auto flex max-w-[1240px] items-center justify-between px-4 py-5 sm:px-6">
        <SiteNav active="gallery" />
        <Link href="/chronicle/" className="ui-press hidden rounded-sm text-meta text-live underline-offset-4 hover:underline sm:block">
          去编年史 →
        </Link>
      </header>

      {/* 先说这些画面是什么，再说年份 */}
      <section className="relative mx-auto max-w-[1240px] px-page pb-12 pt-12 sm:pb-16 sm:pt-16">
        <div className="pointer-events-none absolute -right-20 -top-24 h-[220px] w-[220px] rounded-full bg-today/10 blur-[60px] sm:h-[380px] sm:w-[380px] sm:blur-[110px]" />
        <Eyebrow color="#E5568A" className="ui-reveal relative">Gallery · 记忆盒</Eyebrow>
        <h1 className="ui-reveal relative mt-4 max-w-3xl text-h1 font-semibold">被画下来的几年。</h1>
        <p className="ui-reveal relative mt-5 max-w-2xl text-body text-muted">
          这些画面不是装饰，是水友替每个年份留下来的注脚。
          原图是什么样，这里就是什么样——不修图、不放大、不换背景。
        </p>
        <p className="ui-reveal relative mt-4 text-meta text-faint tnum">
          {items.length} 张已收录 · {years.size} 个年份 · 点开任意一张看大图与来源
        </p>
      </section>

      <section className="relative mx-auto max-w-[1240px] px-page pb-20">
        <GalleryView items={items} />
      </section>

      {/* 缺口：诚实保留，指向补录 */}
      <section className="border-t border-line bg-surface/20">
        <div className="mx-auto max-w-[1240px] px-page py-12 sm:py-20">
          <Eyebrow>Missing chapters</Eyebrow>
          <h2 className="mt-3 max-w-2xl text-h2 font-medium text-ink">还有一些年份，正在等待被找回。</h2>
          <p className="mt-3 max-w-2xl text-body text-muted">
            缺口不是空白页，而是下一次补录的方向。以下年份目前没有找到可公开核验的独立画面；如果你手上有原图、视频或帖子线索，欢迎从这里补上。
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {gaps.map((gap) => (
              <span key={gap.years ?? gap.item} className="rounded-full border border-line px-3 py-1.5 text-meta text-faint tnum">
                {gap.years ?? gap.item}
              </span>
            ))}
          </div>
          <Link href="/contact/" className="ui-press mt-6 inline-block rounded-sm text-meta text-live underline underline-offset-4">
            提供画作线索 →
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
