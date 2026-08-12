/**
 * 节目活动摘要。
 * 所有节目统一为同一种「活跃年份」信息条，不再用迷你柱状图表达时间跨度。
 */
export function ActivityStrip({
  perYear,
  color = '#8B8FA3',
  className = '',
}: {
  perYear: { year: number; count: number }[]
  color?: string
  /** 保留旧调用参数兼容；摘要条不再依赖固定高度。 */
  height?: number
  className?: string
  descriptive?: boolean
}) {
  const active = perYear.filter((item) => item.count > 0)
  const first = active[0]?.year
  const last = active[active.length - 1]?.year
  const total = active.reduce((sum, item) => sum + item.count, 0)
  const years = first == null ? '暂无记录' : first === last ? String(first) : `${first} — ${last}`

  return (
    <div
      className={`flex min-h-[2.75rem] items-center justify-between gap-4 rounded-lg border border-line/60 bg-base/25 px-[clamp(0.75rem,1vw,1.25rem)] py-2.5 ${className}`}
      role="img"
      aria-label={`活跃年份 ${years}${total ? `，共 ${total} 期` : ''}`}
    >
      <span className="flex min-w-0 items-center gap-2 text-meta text-muted">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 0.625rem ${color}66` }} />
        活跃年份
      </span>
      <span className="min-w-0 text-right font-mono text-meta text-ink tnum">
        {years}{total > 0 && <> · {total.toLocaleString()} 期</>}
      </span>
    </div>
  )
}
