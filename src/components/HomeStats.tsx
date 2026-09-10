import Link from 'next/link'
import type { HomepageData } from '@/lib/narrative'
import { Eyebrow } from './primitives'
import { Reveal } from './Reveal'

/**
 * 首页尾声：「三段日子」。
 * 数字不进第一屏，也不在这里结算总数；这里只以幕的分布呈现，而不是 Dashboard 指标。
 * 分布条按互斥口径计数（ACT I <2015 / ACT II 2015-2021 / ACT III ≥2022）——三幕无重叠，相加正好等于全部记录；
 * 幕头展示的年份是叙事范围（ACT II 与 ACT III 有叙事重叠），分布条计数与叙事年份刻意不同口径。
 */
export function HomeStats({ data }: { data: HomepageData }) {
  const actRows = data.acts
  const counts = data.exclusiveCounts.length === actRows.length ? data.exclusiveCounts : actRows.map((a) => a.count)
  const total = counts.reduce((sum, c) => sum + c, 0) || 1
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
          <Eyebrow>Eras · 三段日子</Eyebrow>
          {/*
            这一节原本是「N 年，最后是这些数字」+ 三个大号总数（条目 / 年份 / 栏目）。
            那三个数把一个人十六年的产出结算成一张 KPI 卡，读起来是被统计，不是被记得，
            而且它们既不可点也不通向任何地方。改成只留三幕分布：同样是这些记录，
            但说的是「哪一段日子留下的最多」，每一行都还能顺着往下走。
          */}
          <h2 className="mt-3 text-h2 font-semibold text-ink">一路走下来，其实是三段不一样的日子。</h2>

          {/* 三幕分布（互斥口径） */}
          <div className="mt-8 w-full">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-raised">
              {actRows.map((a, i) => (
                <span
                  key={a.act.id}
                  className="h-full transition-[width] duration-700"
                  style={{ width: `${(counts[i] / total) * 100}%`, background: a.act.color, opacity: 0.85 }}
                />
              ))}
            </div>
            <ul className="mt-4 space-y-2">
              {actRows.map((a, i) => (
                <li key={a.act.id} className="flex items-baseline gap-3 text-meta">
                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: a.act.color }} />
                  <span className="shrink-0 whitespace-nowrap font-mono text-faint tnum">{a.act.years}</span>
                  <span className="min-w-0 truncate text-muted">{a.act.label}</span>
                  <span className="ml-auto shrink-0 text-faint tnum">{counts[i].toLocaleString()} 条</span>
                </li>
              ))}
            </ul>
            {gapYears.length > 0 && (
              <p className="mt-2 text-meta text-faint">
                {gapYears.join('、')} 年在档案里是留白——缺口不是错误，是还没有被找回来的部分。
              </p>
            )}
          </div>

          <div className="mt-8">
            <Link
              href="/archive/"
              prefetch={false}
              className="ui-press group inline-flex items-center gap-2 rounded-full border border-line bg-base/60 px-5 py-2.5 text-control text-muted transition-colors hover:border-muted hover:text-ink"
            >
              去录播室，找你记得的那一天
              <span className="font-mono text-meta transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
