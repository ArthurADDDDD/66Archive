'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { GameCardData } from '@/lib/games'

/** 封面缺失 / 加载失败时的档案式字排版封面（不是随机彩色渐变）：
 * 时代 accent 只由首次年份决定（视频 #E0A244 / 斗鱼 #5BC8E8 / 抖音 #FF6B75），
 * 内容只有真实信息：游戏名 / 年份 / 场次。 */
const ERAS = [
  { maxYear: 2015, label: '视频时代', color: '#E0A244' },
  { maxYear: 2023, label: '斗鱼时代', color: '#5BC8E8' },
  { maxYear: 9999, label: '抖音时代', color: '#FF6B75' },
] as const

function eraFor(firstDate: string | null) {
  const year = firstDate ? Number(firstDate.slice(0, 4)) : 0
  return ERAS.find((e) => year <= e.maxYear) ?? ERAS[2]
}

/**
 * 游戏收藏架的一块瓦片：封面优先，hover 给出更多。
 * 桌面 hover：盖一层首次 / 最后 / 场次 / 时长；移动端（无 hover）靠下方 meta 行。
 * 没有封面、或封面远程加载失败（onError）时，退化为字排版档案封面——绝不用假图。
 */
export function GameCard({ profile: p }: { profile: GameCardData }) {
  const [broken, setBroken] = useState(false)
  const coverOk = Boolean(p.cover) && !broken
  const era = eraFor(p.firstDate)

  return (
    <Link
      href={`/games/${p.id}/`}
      data-analytics-event="content.open"
      data-analytics-target={`game:${p.id}`}
      className="ui-card ui-press group relative block overflow-hidden rounded-xl border border-line bg-surface/40 transition-colors hover:border-muted hover:shadow-[0_16px_48px_rgba(0,0,0,0.28)]"
    >
      <div className="relative aspect-video overflow-hidden bg-raised">
        {coverOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.cover!}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
          />
        ) : (
          <div
            className="relative flex h-full w-full flex-col items-center justify-center px-3"
            style={{ background: `linear-gradient(180deg, ${era.color}1f, transparent 55%)` }}
          >
            {/* 细点纹理：档案感，不是装饰性乱码 */}
            <span
              aria-hidden
              className="absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage: `radial-gradient(circle, ${era.color} 1px, transparent 1px)`,
                backgroundSize: '14px 14px',
              }}
            />
            <span
              className="absolute left-2.5 top-2 text-meta uppercase tracking-[0.16em]"
              style={{ color: era.color }}
            >
              {era.label}
            </span>
            <span className="relative max-w-full text-center text-[1.0625rem] font-bold leading-tight text-ink/90">
              {p.name}
            </span>
            {p.firstDate && (
              <span className="relative mt-2 text-meta text-faint tnum">
                {p.firstDate.slice(0, 4)}
                {p.sessions > 0 ? ` · ${p.sessions} 场` : ' · 待补录'}
              </span>
            )}
          </div>
        )}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-base/85 to-transparent" />
        {coverOk && <span className="absolute bottom-2 left-3 right-8 truncate text-control font-medium text-ink">{p.name}</span>}
        <span aria-hidden className="absolute bottom-2 right-3 font-mono text-meta text-faint transition-all group-hover:translate-x-1 group-hover:text-live">
          →
        </span>

        {/* 桌面 hover：首次 / 最后 / 场次 / 时长 */}
        {p.sessions > 0 && (
          <div className="pointer-events-none absolute inset-0 hidden flex-col justify-center gap-2 bg-base/85 p-5 opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100 sm:flex">
            {(
              [
                ['首次', p.firstDate ?? '—'],
                ['最后', p.lastDate ?? '—'],
                ['场次', `${p.sessions.toLocaleString()} 场`],
                ['时长', p.hoursLabel],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3">
                <span className="text-meta uppercase tracking-[0.16em] text-faint">{label}</span>
                <span className="font-mono text-meta text-ink tnum">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="px-3 py-2.5">
        {p.sessions > 0 ? (
          <p className="text-meta text-faint tnum">
            {p.sessions} 场 · {p.hoursLabel} · {p.firstDate} 起
          </p>
        ) : (
          <p className="text-meta text-faint">档案中暂无已标记条目 · 待补录</p>
        )}
      </div>
    </Link>
  )
}
