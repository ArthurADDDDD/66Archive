import Link from 'next/link'
import type { HomepageData } from '@/lib/narrative'
import { Reveal } from './Reveal'

/**
 * 第二屏统计：「这一切加起来」。
 * 数字不进第一屏；这里以幕的分布呈现，而不是 Dashboard 指标。
 */
export function HomeStats({ data }: { data: HomepageData }) {
  const actRows = data.acts.filter((a) => a.act.id !== 'interlude')
  const total = actRows.reduce((sum, a) => sum + a.count, 0) || 1
  const firstYear = 2010
  const latestYear = data.now.year
  const yearsSet = new Set(data.years)
  const gapYears: string[] = []
  for (let y = Number(firstYear); y <= Number(latestYear); y++) {
    const s = String(y)
    // 幕间本身就是刻意的空白，不算缺口
    if (s === '2023' || s === '2024') continue
    if (!yearsSet.has(s)) gapYears.push(s)
  }

  return (
    <section className="border-t border-line bg-surface/25 py-14 sm:py-24">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <Reveal>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">这一切加起来</p>
          <div className="mt-6 grid grid-cols-3 gap-4 sm:max-w-xl">
            <Stat value={data.totals.entries.toLocaleString()} label="公开条目" />
            <Stat value={data.totals.years.toString()} label="覆盖年份" />
            <Stat value={data.totals.series.toString()} label="系列栏目" />
          </div>

          {/* 三幕分布 */}
          <div className="mt-8 max-w-2xl sm:mt-10">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-raised">
              {actRows.map((a) => (
                <span
                  key={a.act.id}
                  className="h-full transition-[width] duration-700"
                  style={{ width: `${(a.count / total) * 100}%`, background: a.act.color, opacity: 0.85 }}
                />
              ))}
            </div>
            <ul className="mt-4 space-y-2">
              {actRows.map((a) => (
                <li key={a.act.id} className="flex items-baseline gap-3 text-[12px]">
                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: a.act.color }} />
                  <span className="w-[92px] shrink-0 font-mono text-[10px] text-faint tnum">{a.act.years}</span>
                  <span className="min-w-0 truncate text-muted">{a.act.label}</span>
                  <span className="ml-auto font-mono text-[11px] text-faint tnum">{a.count.toLocaleString()} 条</span>
                </li>
              ))}
            </ul>
            {gapYears.length > 0 && (
              <p className="mt-5 font-mono text-[10px] leading-5 text-faint/70">
                {gapYears.join('、')} 年在档案里是留白——缺口不是错误，是还没有被找回来的部分。
              </p>
            )}
          </div>

          <div className="mt-10">
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
      <dt className="font-display text-[26px] font-bold text-ink tnum sm:text-[32px]">{value}</dt>
      <dd className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-faint">{label}</dd>
    </div>
  )
}
