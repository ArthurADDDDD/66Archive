/**
 * 活动纹理：按年的小刻度条。
 * 不是甘特图，是「2016 ━━━ ━━ ━━━━━━」式的质感。
 * 缺年份留空——空缺本身是历史的一部分。
 */
export function ActivityStrip({
  perYear,
  color = '#8B8FA3',
  height = 26,
  className = '',
}: {
  perYear: { year: number; count: number }[]
  color?: string
  height?: number
  className?: string
}) {
  const byYear = new Map(perYear.map((p) => [p.year, p.count]))
  const years = perYear.length ? range(perYear[0].year, perYear[perYear.length - 1].year) : []
  const max = Math.max(1, ...perYear.map((p) => p.count))

  return (
    <div
      className={`flex items-end gap-4 ${className}`}
      role="img"
      aria-label={`按年活动分布：${perYear.map((p) => `${p.year} 年 ${p.count} 期`).join('，')}`}
    >
      {years.map((year) => {
        const count = byYear.get(year) ?? 0
        return (
          <div key={year} className="flex w-[7px] flex-col items-center sm:w-[5px]">
            <div className="flex items-end" style={{ height }}>
              {count > 0 && (
                <span
                  className="w-[5px] rounded-full"
                  style={{ height: Math.max(5, Math.round(5 + (count / max) * (height - 5))), background: color }}
                  title={`${year} 年 ${count} 期`}
                />
              )}
            </div>
            <span className={`mt-1 font-mono text-meta leading-3 text-faint tnum ${year % 2 ? 'hidden sm:block' : ''}`}>{year}</span>
          </div>
        )
      })}
    </div>
  )
}

function range(a: number, b: number) {
  const out: number[] = []
  for (let i = a; i <= b; i++) out.push(i)
  return out
}
