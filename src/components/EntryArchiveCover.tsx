'use client'

import { actColorForDate } from '@/lib/narrative'
import { useSiteTexts } from './LiveContentProvider'

/** 只取排版要用的几项，录播室的 TimelineEntry 和条目页自己拼的数据都能直接传。 */
export type ArchiveCoverEntry = {
  date: string
  title: string
  games: { name: string }[]
  sourceCount: number
  aliveCount: number
}

/**
 * 条目没有封面时的字排版档案封面。
 *
 * 没封面的几乎都是没有录像的占位条目，拿不到任何一张属于这一场的画面——
 * 同游戏别的场次截图、游戏官方图都不是这一天，放上去就是假图（与游戏厅
 * 无封面瓦片同一个原则）。所以只排真实信息：日期、这场的游戏或标题，
 * 再用一个角标说清楚为什么没有图：还没找到录像 / 链接失效 / 有录像但没取到封面。
 */
export function EntryArchiveCover({ entry, size = 'grid' }: { entry: ArchiveCoverEntry; size?: 'grid' | 'detail' }) {
  const t = useSiteTexts()
  const color = actColorForDate(entry.date)
  const heading = entry.games.length > 0 ? entry.games.map((game) => game.name).join(' · ') : entry.title
  const reason =
    entry.sourceCount === 0
      ? t('entry-cover-no-replay')
      : entry.aliveCount === 0
        ? t('entry-cover-dead')
        : t('entry-cover-missing')

  return (
    <span
      className="relative flex h-full w-full flex-col items-center justify-center px-4"
      style={{ background: `linear-gradient(180deg, ${color}24, transparent 60%)` }}
    >
      <span
        aria-hidden
        className="absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: `radial-gradient(circle, ${color} 1px, transparent 1px)`, backgroundSize: '14px 14px' }}
      />
      {/* 网格卡片下方已经写着日期，左上角还要留给来源数角标；只在详情里写日期。 */}
      {size === 'detail' && (
        <span className="absolute left-3 top-3 font-mono text-meta tracking-[0.12em] tnum" style={{ color }}>
          {entry.date}
        </span>
      )}
      <span
        className={`relative line-clamp-2 max-w-full text-center font-bold leading-tight text-ink/85 ${size === 'detail' ? 'text-h3' : 'text-control'}`}
      >
        {heading}
      </span>
      <span className="relative mt-2 rounded-full border border-line/80 bg-base/60 px-2 py-0.5 text-[11px] text-faint">
        {reason}
      </span>
    </span>
  )
}
