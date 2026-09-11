'use client'

import { useLiveContent } from './LiveContentProvider'

export type HomeEraRow = { id: string; color: string; years: string; label: string }

/**
 * 「三段日子」的分布条与三行图例。
 *
 * 每一幕的名字、年份、配色和首页三幕舞台是同一份叙事——后台「三幕」里改了，这里跟着变。
 * 此前这里读的是构建期基线，后台改了幕名，首页上面变了、这里还是旧的。
 * 计数仍然是构建期按互斥口径算好的，不跟着后台变（那是档案本身的数，不是文案）。
 */
export function HomeEraDistribution({ rows, counts }: { rows: HomeEraRow[]; counts: number[] }) {
  const { narrative } = useLiveContent()
  const resolved = rows.map((row) => {
    const live = narrative?.homeActs.find((act) => act.id === row.id)
    return {
      ...row,
      color: live?.color || row.color,
      years: live?.years || row.years,
      label: live?.label || row.label,
    }
  })
  const total = counts.reduce((sum, count) => sum + count, 0) || 1

  return (
    <>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-raised">
        {resolved.map((row, index) => (
          <span
            key={row.id}
            className="h-full transition-[width] duration-700"
            style={{ width: `${(counts[index] / total) * 100}%`, background: row.color, opacity: 0.85 }}
          />
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {resolved.map((row, index) => (
          <li key={row.id} className="flex items-baseline gap-3 text-meta">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: row.color }} />
            <span className="shrink-0 whitespace-nowrap font-mono text-faint tnum">{row.years}</span>
            <span className="min-w-0 truncate text-muted">{row.label}</span>
            <span className="ml-auto shrink-0 text-faint tnum">{counts[index].toLocaleString()} 条</span>
          </li>
        ))}
      </ul>
    </>
  )
}
