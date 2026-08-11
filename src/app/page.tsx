import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { RotatingAvatar } from '@/components/RotatingAvatar'
import { getDataset } from '@/lib/data'

export default function HomePage() {
  const ds = getDataset()
  const years = new Set(ds.entries.map((entry) => entry.date.slice(0, 4))).size
  const countBetween = (from: string, to: string) => ds.entries.filter((entry) => entry.date >= from && entry.date <= to).length

  const chapters = [
    {
      year: '2010',
      label: '从视频开始',
      title: '《迷画之塔》与早期游戏解说',
      description: '本科期间，她在优酷上传自制游戏视频，逐渐成为广受关注的原创游戏视频作者。',
      count: countBetween('2010-01-01', '2015-12-31'),
      color: '#E0A244',
      href: '/chronicle/?y=2010',
    },
    {
      year: '2015—2023',
      label: '斗鱼直播时期',
      title: '直播间 156277 与固定栏目',
      description: '2015 年转型为主机游戏主播，直播与解说继续围绕优秀、独特的游戏作品展开。',
      count: countBetween('2016-01-01', '2023-12-31'),
      color: '#5BC8E8',
      href: '/chronicle/?y=2023',
    },
    {
      year: '2024.02',
      label: '过渡记录',
      title: '空窗期内的一次语音直播',
      description: '斗鱼停播与下一阶段之间，现有资料中保留的一次独立公开记录。',
      count: countBetween('2024-02-01', '2024-02-29'),
      color: '#A78BFA',
      href: '/chronicle/?y=2024&m=2',
    },
    {
      year: '2024.08—至今',
      label: '抖音直播时期',
      title: '新的平台，继续直播',
      description: '直播记录由多个公开回放与搬运来源共同补齐，仍在持续更新。',
      count: countBetween('2024-08-01', '9999-12-31'),
      color: '#FF6B75',
      href: '/chronicle/?y=2026',
    },
  ]

  return (
    <main className="ui-page-in min-h-screen overflow-hidden">
      <header className="ui-slide-down relative z-20 mx-auto flex max-w-[1240px] items-center justify-between px-4 py-5 sm:px-6">
        <SiteNav active="home" />
        <Link href="/chronicle/" className="ui-press hidden rounded-sm font-mono text-[11px] text-live underline-offset-4 hover:underline sm:block">
          打开全部 {ds.entries.length.toLocaleString()} 条记录 →
        </Link>
      </header>

      <section className="relative mx-auto max-w-[1240px] px-4 pb-20 pt-14 sm:px-6 sm:pb-28 sm:pt-20">
        <div className="pointer-events-none absolute -right-24 -top-40 h-[520px] w-[520px] rounded-full bg-live/10 blur-[100px]" />
        <div className="pointer-events-none absolute -left-44 top-24 h-[460px] w-[460px] rounded-full bg-today/10 blur-[110px]" />
        <div className="relative grid gap-12 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
          <div className="ui-reveal">
            <div className="inline-flex items-center gap-2 rounded-full border border-live/30 bg-live/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-live">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-live" />
              2010 — 现在
            </div>
            <p className="mt-7 font-mono text-[11px] uppercase tracking-[0.28em] text-faint">女流 66 · 石悦</p>
            <h1 className="mt-3 max-w-3xl text-[44px] font-bold leading-[1.04] tracking-[-0.04em] text-ink sm:text-[68px]">
              十六年的游戏、直播，
              <span className="bg-gradient-to-r from-video via-live to-today bg-clip-text text-transparent">重新连成一条路。</span>
            </h1>
            <p className="mt-7 max-w-2xl text-[15px] leading-8 text-muted">
              女流以独立游戏和具有艺术性的作品为主要内容，从优酷时代的原创游戏解说出发，后来转向主机游戏直播。这里整理她公开发表过的视频与直播场次，只建立索引，不搬运视频。
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/chronicle/" className="ui-press group rounded-full bg-ink px-6 py-3 text-[13px] font-medium text-base hover:shadow-[0_16px_50px_rgba(91,200,232,0.22)]">
                浏览编年史 <span className="ml-2 inline-block transition-transform group-hover:translate-x-1">→</span>
              </Link>
              <a href="#career" className="ui-press rounded-full border border-line bg-surface/60 px-6 py-3 text-[13px] text-muted hover:border-muted hover:text-ink">
                先看生涯总览
              </a>
            </div>
          </div>

          <div className="ui-reveal ui-delay-1 relative mx-auto aspect-square w-full max-w-[440px]">
            <div className="absolute inset-[8%] animate-[spin_35s_linear_infinite] rounded-full border border-dashed border-line" />
            <div className="absolute inset-[22%] animate-[spin_24s_linear_infinite_reverse] rounded-full border border-live/20" />
            <div className="absolute inset-[34%] rounded-full bg-gradient-to-br from-live/25 via-raised to-today/20 shadow-[0_0_90px_rgba(91,200,232,0.16)]" />
            <div className="absolute inset-0 flex items-center justify-center text-center">
              <div className="relative h-[38%] w-[38%] overflow-hidden rounded-full border-4 border-base/80 shadow-[0_0_35px_rgba(91,200,232,0.24)] ring-1 ring-live/40">
                <RotatingAvatar />
              </div>
            </div>
            {[['12%', '48%', '#E0A244'], ['78%', '18%', '#5BC8E8'], ['83%', '72%', '#FF6B75'], ['25%', '82%', '#A78BFA']].map(([left, top, color], index) => (
              <span key={index} className="absolute h-3 w-3 rounded-full shadow-[0_0_20px_currentColor]" style={{ left, top, color, background: color }} />
            ))}
          </div>
        </div>

        <dl className="ui-reveal ui-delay-2 relative mt-16 grid grid-cols-3 gap-3 border-y border-line py-5 sm:max-w-xl">
          <Stat value={ds.entries.length.toLocaleString()} label="公开条目" />
          <Stat value={years.toString()} label="覆盖年份" />
          <Stat value={ds.series.size.toString()} label="系列栏目" />
        </dl>
      </section>

      <section id="career" className="relative border-t border-line bg-surface/35 py-20 sm:py-28">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-today">Career map</p>
              <h2 className="mt-3 text-[30px] font-semibold tracking-tight sm:text-[42px]">生涯事件时间轴</h2>
            </div>
            <p className="max-w-md text-[12px] leading-relaxed text-muted">这是入口级概览；具体到每一年、每个月和每条来源，请进入编年史。</p>
          </div>

          <div className="relative mt-12 grid gap-4 lg:grid-cols-4">
            <div className="absolute left-0 right-0 top-[31px] hidden h-px bg-gradient-to-r from-video via-live to-today lg:block" />
            {chapters.map((chapter, index) => (
              <Link
                key={chapter.year}
                href={chapter.href}
                className="ui-card ui-press group relative rounded-2xl border border-line bg-base/80 p-5 hover:border-muted hover:shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
              >
                <span className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-4 border-base text-[9px] font-bold text-base" style={{ background: chapter.color }}>
                  {index + 1}
                </span>
                <span className="mt-8 block font-mono text-[11px] tnum" style={{ color: chapter.color }}>{chapter.year}</span>
                <span className="mt-2 block text-[11px] text-faint">{chapter.label}</span>
                <h3 className="mt-2 text-[17px] font-medium leading-snug text-ink">{chapter.title}</h3>
                <p className="mt-3 text-[12px] leading-relaxed text-muted">{chapter.description}</p>
                <span className="mt-6 flex items-center justify-between border-t border-line pt-3 font-mono text-[10px] text-faint">
                  {chapter.count.toLocaleString()} 条记录
                  <span className="transition-transform group-hover:translate-x-1" style={{ color: chapter.color }}>→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1240px] flex-col justify-between gap-4 px-4 py-10 font-mono text-[10px] text-faint sm:flex-row sm:px-6">
        <span>只索引，不搬运 · 所有播放回到原平台</span>
        <Link href="/contact/" className="ui-press rounded-sm transition-colors hover:text-live">资料纠错与联系 →</Link>
      </footer>
    </main>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="font-display text-[22px] font-bold text-ink tnum">{value}</dt>
      <dd className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-faint">{label}</dd>
    </div>
  )
}
