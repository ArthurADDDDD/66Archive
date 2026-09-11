import Link from 'next/link'
import type { HomepageData } from '@/lib/narrative'
import { Reveal } from './Reveal'
import { HomeEraDistribution } from './HomeEraDistribution'
import { LiveSectionHeading } from './LiveSection'
import { SiteText } from './SiteText'

/**
 * 首页尾声：「三段日子」。
 * 数字不进第一屏，也不在这里结算总数；这里只以幕的分布呈现，而不是 Dashboard 指标。
 * 分布条按互斥口径计数（ACT I <2015 / ACT II 2015-2021 / ACT III ≥2022）——三幕无重叠，相加正好等于全部记录；
 * 幕头展示的年份是叙事范围（ACT II 与 ACT III 有叙事重叠），分布条计数与叙事年份刻意不同口径。
 *
 * 小标与标题是后台「站点文案 · 首页区块」的 `home-stats`；幕名与年份跟着后台「三幕」走。
 */
export function HomeStats({ data }: { data: HomepageData }) {
  const actRows = data.acts
  const counts = data.exclusiveCounts.length === actRows.length ? data.exclusiveCounts : actRows.map((a) => a.count)
  const firstYear = 2010
  const latestYear = data.now.year
  const yearsSet = new Set(data.years)
  const gapYears: string[] = []
  for (let y = Number(firstYear); y <= Number(latestYear); y++) {
    const s = String(y)
    // 停播那两年本身是叙事的一部分，不算缺口
    if (s === '2023' || s === '2024') continue
    if (!yearsSet.has(s)) gapYears.push(s)
  }

  return (
    <section id="home-stats" className="scroll-mt-4 border-t border-line bg-surface/25 py-12 sm:py-16">
      <div className="home-content-container px-page">
        <Reveal>
          {/*
            这一节原本是「N 年，最后是这些数字」+ 三个大号总数（条目 / 年份 / 栏目）。
            那三个数把一个人十六年的产出结算成一张 KPI 卡，读起来是被统计，不是被记得，
            而且它们既不可点也不通向任何地方。改成只留三幕分布：同样是这些记录，
            但说的是「哪一段日子留下的最多」，每一行都还能顺着往下走。
          */}
          <LiveSectionHeading sectionId="home-stats" />

          {/* 三幕分布（互斥口径） */}
          <div className="mt-8 w-full">
            <HomeEraDistribution
              rows={actRows.map((a) => ({ id: a.act.id, color: a.act.color, years: a.act.years, label: a.act.label }))}
              counts={counts}
            />
            {gapYears.length > 0 && (
              <p className="mt-2 text-meta text-faint">
                <SiteText id="home-stats-gap" vars={{ years: gapYears.join('、') }} />
              </p>
            )}
          </div>

          <div className="mt-8">
            <Link
              href="/archive/"
              prefetch={false}
              className="ui-press group inline-flex items-center gap-2 rounded-full border border-line bg-base/60 px-5 py-2.5 text-control text-muted transition-colors hover:border-muted hover:text-ink"
            >
              <SiteText id="home-stats-archive" />
              <span className="font-mono text-meta transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
