'use client'

import { PLATFORM_META } from '@/lib/platforms'
import { gameColor } from '@/lib/ui'
import type { Platform } from '@/lib/schema'

export type Filters = {
  q: string
  platforms: string[]
  types: string[]
  games: string[]
  onlyAlive: boolean
}

export const EMPTY_FILTERS: Filters = { q: '', platforms: [], types: [], games: [], onlyAlive: false }

type Props = {
  filters: Filters
  set: (f: Partial<Filters>) => void
  platformCounts: [string, number][]
  gameCounts: { id: string; name: string; count: number }[]
  total: number
  matched: number
}

function toggle(list: string[], v: string) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

export function FilterRail({ filters, set, platformCounts, gameCounts, total, matched }: Props) {
  const dirty =
    filters.q || filters.platforms.length || filters.types.length || filters.games.length || filters.onlyAlive

  return (
    <div className="space-y-6">
      <Section label="类型">
        <div className="flex gap-1.5">
          {[
            { id: 'video', name: '视频', color: '#E0A244' },
            { id: 'live', name: '直播', color: '#5BC8E8' },
          ].map((t) => {
            const on = filters.types.includes(t.id)
            return (
              <button
                key={t.id}
                onClick={() => set({ types: toggle(filters.types, t.id) })}
                aria-pressed={on}
                className="ui-press flex flex-1 items-center justify-center gap-1.5 rounded border py-2.5 font-mono text-[11px] sm:py-1.5"
                style={{
                  borderColor: on ? t.color : '#2C3140',
                  color: on ? t.color : '#8B8FA3',
                  background: on ? `${t.color}14` : 'transparent',
                }}
              >
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: t.color }} />
                {t.name}
              </button>
            )
          })}
        </div>
      </Section>

      <Section label="平台">
        <div className="flex flex-wrap gap-1.5">
          {platformCounts.map(([p, n]) => {
            const meta = PLATFORM_META[p as Platform]
            const on = filters.platforms.includes(p)
            return (
              <button
                key={p}
                onClick={() => set({ platforms: toggle(filters.platforms, p) })}
                aria-pressed={on}
                className="ui-press rounded border px-2 py-2 font-mono text-[11px] tnum sm:py-1"
                style={{
                  borderColor: on ? meta?.color : '#2C3140',
                  color: on ? meta?.color : '#8B8FA3',
                  background: on ? `${meta?.color}14` : 'transparent',
                }}
              >
                {meta?.name ?? p} <span className="opacity-50">{n}</span>
              </button>
            )
          })}
        </div>
      </Section>

      <Section label={`游戏 · ${gameCounts.length}`}>
        <ul className="max-h-64 space-y-px overflow-y-auto pr-1">
          {gameCounts.map((g) => {
            const on = filters.games.includes(g.id)
            return (
              <li key={g.id}>
                <button
                  onClick={() => set({ games: toggle(filters.games, g.id) })}
                  aria-pressed={on}
                  className={`ui-press flex w-full items-center gap-2 rounded px-1.5 py-2 text-left text-[12px] sm:py-1 ${
                    on ? 'bg-raised text-ink' : 'text-muted hover:bg-surface hover:text-ink'
                  }`}
                >
                  <span className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: gameColor(g.id) }} />
                  <span className="min-w-0 flex-1 truncate">{g.name}</span>
                  <span className="font-mono text-[10px] text-faint tnum">{g.count}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </Section>

      <Section label="来源">
        <label className="ui-press flex cursor-pointer items-center gap-2 rounded px-1 py-2 text-[12px] text-muted hover:bg-raised/60 hover:text-ink sm:py-1">
          <input
            type="checkbox"
            checked={filters.onlyAlive}
            onChange={(e) => set({ onlyAlive: e.target.checked })}
            className="h-3.5 w-3.5 accent-live"
          />
          只看还能打开的
        </label>
      </Section>

      <div className="border-t border-line pt-4 font-mono text-[11px] text-faint tnum">
        <div>
          {matched} / {total} 条
        </div>
        {dirty && (
          <button onClick={() => set(EMPTY_FILTERS)} className="ui-press mt-2 rounded-sm text-live underline underline-offset-4">
            清除筛选
          </button>
        )}
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">{label}</h4>
      {children}
    </div>
  )
}
