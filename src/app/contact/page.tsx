import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { BackToTop, MobileQuickNav } from '@/components/ScrollAffordances'
import { Eyebrow } from '@/components/primitives'

export default function ContactPage() {
  return (
    <main className="ui-page-in min-h-screen">
      <MobileQuickNav active="contact" />
      <BackToTop />
      <header className="site-header-container flex items-center px-4 py-5 sm:px-6">
        <SiteNav active="contact" />
      </header>

      <section className="site-container px-page pb-20 pt-16 sm:pt-24">
        <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-today/10 blur-[60px] sm:h-72 sm:w-72 sm:blur-[100px]" />
        <Eyebrow color="#E5568A">Contact &amp; correction</Eyebrow>
        <h1 className="mt-4 max-w-2xl text-h1 font-semibold">让这份索引更准确。</h1>
        <p className="mt-6 max-w-2xl text-body text-muted">
          如果你发现日期、标题、链接或直播内容有误，可以提交线索。公开互动与用户贡献系统尚未上线，目前不会收集手机号、微信或第三方账号信息。
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <article className="ui-card rounded-2xl border border-line bg-surface/55 p-6 hover:border-live/40">
            <span className="text-meta uppercase tracking-[0.16em] text-live">资料纠错</span>
            <h2 className="mt-3 text-h3 font-medium">需要提供什么</h2>
            <ul className="mt-4 space-y-2 text-body text-muted">
              <li>具体条目的页面地址</li>
              <li>认为有误或缺失的字段</li>
              <li>能够佐证修改的公开来源</li>
            </ul>
          </article>

          <article className="ui-card rounded-2xl border border-line bg-surface/55 p-6 hover:border-today/40">
            <span className="text-meta uppercase tracking-[0.16em] text-today">联系渠道</span>
            <h2 className="mt-3 text-h3 font-medium">上线前暂未开放</h2>
            <p className="mt-4 text-body text-muted">
              正式渠道会在互动审核机制确定后公布。当前页面先用于明确站点结构，避免展示未经确认的联系方式。
            </p>
          </article>

          <Link
            href="/calibrate/"
            className="ui-card ui-press group rounded-2xl border border-live/30 bg-live/5 p-6 hover:border-live/60 sm:col-span-2"
          >
            <span className="text-meta uppercase tracking-[0.16em] text-live">Calibration · 真人校准</span>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-h3 font-medium">帮忙判断一条内容</h2>
                <p className="mt-2 max-w-2xl text-body text-muted">从管理员给出的候选标签里点选答案，帮助我们发现标题没有写出来的游戏。无需注册，结果只作为人工复核线索。</p>
              </div>
              <span className="text-meta text-live transition-transform group-hover:translate-x-1">开始校准 ↗</span>
            </div>
          </Link>

          <a
            href="https://github.com/ArthurADDDDD/66archive"
            target="_blank"
            rel="noopener noreferrer"
            className="ui-card ui-press group rounded-2xl border border-line bg-surface/55 p-6 hover:border-live/40 sm:col-span-2"
          >
            <span className="text-meta uppercase tracking-[0.16em] text-live">项目仓库</span>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-h3 font-medium">GitHub · 66archive</h2>
                <p className="mt-2 text-body text-muted">查看项目源码、数据更新和版本记录。</p>
              </div>
              <span className="text-meta text-live transition-transform group-hover:translate-x-1">打开仓库 ↗</span>
            </div>
          </a>
        </div>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/chronicle/" className="ui-press rounded-full bg-ink px-5 py-2.5 text-control font-medium text-[#12141C] hover:bg-white hover:shadow-[0_12px_38px_rgba(91,200,232,0.18)]">
            前往编年史
          </Link>
          <Link href="/" className="ui-press rounded-full border border-line px-5 py-2.5 text-control text-muted hover:border-muted hover:text-ink">
            返回首页
          </Link>
        </div>
      </section>
    </main>
  )
}
