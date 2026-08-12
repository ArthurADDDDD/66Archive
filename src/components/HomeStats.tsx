import Link from 'next/link'
import type { HomepageData } from '@/lib/narrative'
import { Eyebrow } from './primitives'
import { Reveal } from './Reveal'

/**
 * 第二屏统计：「这一切加起来」。
 * 数字不进第一屏；这里以幕的分布呈现，而不是 Dashboard 指标。
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
    <section className="border-t border-line bg-surface/25 py-12 sm:py-16">
      <div className="mx-auto max-w-[1240px] px-page">
        <Reveal>
          <Eyebrow>Totals · 这一切加起来</Eyebrow>
          {/* 这一节原本只有一行 10px 眉标、没有标题，读下来是全页唯一一个缺层级的地方 */}
          <h2 className="mt-3 text-h2 font-semibold text-ink">十六年，最后是这些数字。</h2>
          <dl className="mt-8 grid grid-cols-3 gap-4 sm:max-w-xl">
            <Stat value={data.totals.entries.toLocaleString()} label="公开条目" />
            <Stat value={data.totals.years.toString()} label="覆盖年份" />
            <Stat value={data.totals.series.toString()} label="系列栏目" />
          </dl>

          {/* 三幕分布（互斥口径） */}
          <div className="mt-8 max-w-2xl">
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
                  <span className="w-[92px] shrink-0 font-mono text-faint tnum">{a.act.years}</span>
                  <span className="min-w-0 truncate text-muted">{a.act.label}</span>
                  <span className="ml-auto shrink-0 text-faint tnum">{counts[i].toLocaleString()} 条</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-meta text-faint">
              分布按互斥口径计数：2022 年起的记录计入第三幕（第三幕的叙事从她人生的新一段讲起，与第二幕尾段重叠）。
              三幕相加，正好等于全部记录。
            </p>
            {gapYears.length > 0 && (
              <p className="mt-2 text-meta text-faint">
                {gapYears.join('、')} 年在档案里是留白——缺口不是错误，是还没有被找回来的部分。
              </p>
            )}
          </div>

          <div className="mt-8">
            <Link
              href="/chronicle/"
              className="ui-press group inline-flex items-center gap-2 rounded-full border border-line bg-base/60 px-5 py-2.5 text-[13px] text-muted transition-colors hover:border-muted hover:text-ink"
            >
              打开全部 {data.totals.entries.toLocaleString()} 条记录
              <span className="font-mono text-[12px] transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="font-display text-h3 font-bold text-ink tnum">{value}</dt>
      <dd className="mt-1 text-meta uppercase tracking-[0.16em] text-faint">{label}</dd>
    </div>
  )
}
