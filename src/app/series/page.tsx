import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { BackToTop, MobileQuickNav } from '@/components/ScrollAffordances'
import { ActivityStrip } from '@/components/ActivityStrip'
import { Eyebrow, MediaFrame, PageHeader, SiteFooter } from '@/components/primitives'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { buildSeriesList, type SeriesInfo } from '@/lib/series'

const ERA_COLOR: Record<'video' | 'douyu', string> = { video: '#E0A244', douyu: '#5BC8E8' }

/**
 * 节目单：固定出现过的栏目 / 系列。
 * 心灵砒霜（期数最多、横跨整个斗鱼时代）单独以大块深色展示——
 * 夜 / 邮件 / 电台 / 周日 / 长期陪伴的气质靠深色 + 字排 + 留白完成，不画收音机。
 */
export default function SeriesPage() {
  const ds = getDataset()
  const timeline = toTimelineEntries(ds)
  const series = buildSeriesList(ds, timeline)
  const pishuang = series.find((s) => s.id === 'xinling-pishuang')
  const rest = series.filter((s) => s.id !== 'xinling-pishuang')
  const videoEra = rest.filter((s) => s.era === 'video')
  const douyuEra = rest.filter((s) => s.era === 'douyu')

  return (
    <main className="ui-page-in min-h-screen overflow-x-clip">
      <MobileQuickNav active="series" />
      <BackToTop />
      <header className="ui-slide-down relative z-20 mx-auto flex max-w-[1240px] items-center justify-between px-4 py-5 sm:px-6">
        <SiteNav active="series" />
        <Link
          href="/chronicle/"
          className="ui-press hidden rounded-sm text-meta text-live underline-offset-4 hover:underline sm:block"
        >
          在编年史搜索全部记录 →
        </Link>
      </header>

      <section className="mx-auto max-w-[1240px] px-page pb-12 pt-10 sm:pb-16 sm:pt-14">
        <PageHeader
          eyebrow="Series · 节目单"
          eyebrowColor="#A78BFA"
          title="固定出现过的节目"
          lede="从视频解说时代的连载，到斗鱼时代的每周日。这些栏目的名字会在时间线里反复出现——它们是那些年里的固定节目，也是她答应过会来、就一定会来的约定。"
        />
      </section>

      {pishuang && (
        <section className="border-y border-line/70 bg-[#0C0E15]">
          <div className="mx-auto grid max-w-[1240px] items-start gap-10 px-page py-12 sm:py-20 lg:grid-cols-[1.15fr_.85fr] lg:gap-20">
            <div>
              <Eyebrow color="#5BC8E8" dot>
                周日情感电台 · 斗鱼时期 · 心灵砒霜
              </Eyebrow>
              <h2 className="mt-5 text-hero font-bold tracking-[-0.01em] text-ink">心灵砒霜</h2>
              <p className="mt-5 max-w-xl text-body text-muted">{pishuang.description}</p>
              <div className="mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-meta text-muted tnum">
                <span className="text-body text-ink">{pishuang.count} 期</span>
                <span>档案确认 · 构建期从数据派生</span>
                <span>2016.08 — 2023.11</span>
                <span>横跨 8 年</span>
              </div>
              <div className="mt-8">
                <ActivityStrip perYear={pishuang.perYear} color="#5BC8E8" height={34} />
              </div>
            </div>

            <div className="flex flex-col gap-8 lg:pt-10">
              {pishuang.firstTitle && (
                <blockquote className="border-l-2 border-line/60 pl-5">
                  <p className="text-h3 font-medium leading-relaxed text-ink/90">第一期是「{pishuang.firstTitle}」。</p>
                  <p className="mt-3 text-meta text-muted tnum">第一期标题，原文照录 · {pishuang.firstDate}</p>
                </blockquote>
              )}
              <p className="max-w-md text-body text-muted">
                游戏暂停，邮件打开，一个星期日。后来这件事被保存下来 {pishuang.count} 次——有的很长，有的很短，固定地出现在每周日。
              </p>
              <Link
                href="/series/xinling-pishuang/"
                className="ui-press group inline-flex w-fit items-center gap-2 rounded-full border border-line/80 px-5 py-2.5 text-[13px] text-ink transition-colors hover:border-live/60 hover:text-live"
              >
                打开心灵砒霜的全部 {pishuang.count} 期
                <span aria-hidden className="font-mono text-meta transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-[1240px] px-page py-12 sm:py-20">
        <EraGroup label="视频解说时代" years="2010 — 2015" color={ERA_COLOR.video} series={videoEra} />
        <div className="mt-14" />
        <EraGroup label="斗鱼直播时代" years="2016 — 2023" color={ERA_COLOR.douyu} series={douyuEra} />
      </section>

      <SiteFooter />
    </main>
  )
}

function EraGroup({ label, years, color, series }: { label: string; years: string; color: string; series: SeriesInfo[] }) {
  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-line/60 pb-3">
        <Eyebrow color={color} dot>
          {label}
        </Eyebrow>
        <span className="font-mono text-meta text-faint tnum">{years}</span>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {series.map((s) => (
          <Link
            key={s.id}
            href={`/series/${s.id}/`}
            className="ui-press group flex flex-col rounded-xl border border-line/80 bg-surface/40 p-5 transition-colors hover:border-muted/60 hover:bg-surface"
          >
            {s.cover ? (
              <MediaFrame src={s.cover} alt={s.name} className="h-28 w-full" />
            ) : (
              <div className="flex h-16 w-full items-center">
                <span className="text-h3 font-bold text-ink/85">{s.name}</span>
              </div>
            )}
            <h3 className="mt-4 text-[16px] font-semibold tracking-tight text-ink">{s.name}</h3>
            <p className="mt-1.5 text-meta text-faint tnum">
              {s.count} 期 · {s.firstDate.slice(0, 4)}.{s.firstDate.slice(5, 7)} — {s.lastDate.slice(0, 4)}.{s.lastDate.slice(5, 7)}
            </p>
            <p className="mt-2.5 line-clamp-2 min-h-[2.8em] text-body text-muted">{s.description}</p>
            <div className="mt-4">
              <ActivityStrip perYear={s.perYear} color={color} height={22} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
