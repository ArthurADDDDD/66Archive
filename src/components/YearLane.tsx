import { actColorForDate } from '@/lib/narrative'

/**
 * 数据页的「按年跨度」图形。
 *
 * 两个共同点：
 * 1. 都铺满整条版心（grid 1fr 列，尺寸走 clamp），宽屏不会缩在左边；
 * 2. 都以「档案全跨度」为底：没有记录的年份留成暗格，空档本身就是信息。
 */

type LaneYear = { year: number; count: number }

function buildSpan(from: number, to: number, perYear: LaneYear[]): { year: number; count: number }[] {
  const counts = new Map(perYear.map((row) => [row.year, row.count]))
  const span: { year: number; count: number }[] = []
  for (let year = from; year <= to; year++) span.push({ year, count: counts.get(year) ?? 0 })
  return span
}

/**
 * 一条年份跑道：有记录的年份是实心柱（高度＝这一年的多少），没有的年份是暗格。
 * 用在「隔了几年还会回来」「节目坚持了多久」——一眼看出连续与断档。
 */
export function YearLane({
  from,
  to,
  perYear,
  color,
  unit = '条',
  compact = false,
  showAxis = true,
}: {
  from: number
  to: number
  perYear: LaneYear[]
  /** 不传则按年份取时期色 */
  color?: string
  unit?: string
  /** 紧凑模式：矮一档，用于一节里堆多行 */
  compact?: boolean
  /** 一节里堆多行时关掉，改由 YearAxis 在列表顶部标一次 */
  showAxis?: boolean
}) {
  const span = buildSpan(from, to, perYear)
  const max = Math.max(1, ...span.map((row) => row.count))
  const height = compact ? 'h-[clamp(1rem,1.4vw,1.375rem)]' : 'h-[clamp(1.25rem,1.8vw,1.75rem)]'

  return (
    <div>
      <div
        className="grid gap-[clamp(0.125rem,0.4vw,0.5rem)]"
        style={{ gridTemplateColumns: `repeat(${span.length}, minmax(0, 1fr))` }}
      >
        {span.map(({ year, count }) => (
          <span
            key={year}
            title={count > 0 ? `${year} 年 · ${count.toLocaleString()} ${unit}` : `${year} 年 · 没有记录`}
            className={`flex ${height} flex-col justify-end overflow-hidden rounded-[0.25rem] ${
              count > 0 ? 'bg-raised/55' : 'bg-base/40 ring-1 ring-inset ring-line/70'
            }`}
          >
            {count > 0 ? (
              <span
                className="block w-full rounded-[0.25rem]"
                style={{
                  height: `${Math.max(28, (count / max) * 100)}%`,
                  background: color ?? actColorForDate(`${year}-06-15`),
                }}
              />
            ) : (
              // 空年份不是留白，是信息：给一条贴底的暗线，断档在一行里能直接看出来
              <span aria-hidden className="block h-[0.125rem] w-full bg-line/80" />
            )}
          </span>
        ))}
      </div>
      {showAxis && <YearAxis from={from} to={to} className="mt-1" />}
    </div>
  )
}

/** 年份刻度。一节里堆很多条跑道时，刻度只在顶部标一次，不跟着每行重复。 */
export function YearAxis({ from, to, className = '' }: { from: number; to: number; className?: string }) {
  const span = buildSpan(from, to, [])
  return (
    <div
      className={`grid gap-[clamp(0.125rem,0.4vw,0.5rem)] ${className}`}
      style={{ gridTemplateColumns: `repeat(${span.length}, minmax(0, 1fr))` }}
    >
      {span.map(({ year }, index) => (
        <span
          key={year}
          className={`text-center font-mono text-meta leading-none text-faint tnum ${
            index === 0 || index === span.length - 1 || year % 5 === 0 ? '' : 'opacity-0'
          }`}
        >
          {String(year).slice(2)}
        </span>
      ))}
    </div>
  )
}

export type EraColumn = {
  year: number
  segments: { id: string; label: string; color: string; count: number }[]
}

/**
 * 时代更替：每一年一根柱子，柱子内部按平台时期分段。
 * 橙色让位给蓝色、蓝色让位给红色——「时代如何变化」这句话本身就是这张图。
 */
export function EraFlow({ rows }: { rows: EraColumn[] }) {
  const totals = rows.map((row) => row.segments.reduce((sum, segment) => sum + segment.count, 0))
  const max = Math.max(1, ...totals)

  return (
    <div>
      <div
        className="grid items-end gap-[clamp(0.125rem,0.5vw,0.6rem)]"
        style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}
      >
        {rows.map((row, index) => {
          const total = totals[index]
          return (
            <span key={row.year} className="flex h-[clamp(5rem,7.5vw,8rem)] flex-col justify-end gap-[2px]">
              {total === 0 ? (
                <span
                  title={`${row.year} 年 · 没有记录`}
                  className="block h-[0.375rem] w-full rounded-[0.1875rem] bg-raised/60 ring-1 ring-inset ring-line/50"
                />
              ) : (
                row.segments
                  .filter((segment) => segment.count > 0)
                  .map((segment) => (
                    <span
                      key={segment.id}
                      title={`${row.year} 年 · ${segment.label} ${segment.count.toLocaleString()} 条`}
                      className="block w-full rounded-[0.1875rem]"
                      style={{
                        height: `${(segment.count / max) * 100}%`,
                        minHeight: '0.25rem',
                        background: segment.color,
                      }}
                    />
                  ))
              )}
            </span>
          )
        })}
      </div>
      <div
        className="mt-1.5 grid gap-[clamp(0.125rem,0.5vw,0.6rem)]"
        style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}
      >
        {rows.map((row) => (
          // 手机上隔一年隐去一个（用透明度，不能用 hidden——网格列不能塌）
          <span
            key={row.year}
            className={`text-center font-mono text-meta leading-none text-faint tnum ${row.year % 2 ? 'opacity-0 sm:opacity-100' : ''}`}
          >
            {String(row.year).slice(2)}
          </span>
        ))}
      </div>
    </div>
  )
}
