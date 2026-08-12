import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteNav } from '@/components/SiteNav'
import { SeriesCalendar } from '@/components/SeriesCalendar'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { buildSeriesCalendar, buildSeriesStats, WEEKDAY_CN } from '@/lib/series-stats'
import { daysBetween } from '@/lib/game-stats-format'
import { eraOf } from '@/lib/covers'
import { PLATFORM_META, proxyImage } from '@/lib/platforms'
import type { Platform } from '@/lib/schema'
import type { TimelineEntry } from '@/lib/data'

export function generateStaticParams() {
  return [...getDataset().series.values()].map((s) => ({ id: s.id }))
}

/**
 * 系列详情页。
 *
 * 01-vision 第七节有一条硬要求：**「系列」不是一个统一的组件，是几个各自不同的节目，
 * 别把它们套进同一个模板。** 但也不能按 id 写死版式——那样新增一档节目就没人管了。
 *
 * 折中的做法是：**版式由数据自己决定。**
 * 一档节目如果真的固定在某个星期几播（buildSeriesStats 的 dominantWeekday），
 * 它就长成一张跨年的周历；不固定的，就不长。
 * 《心灵砒霜》七年 243 期、219 期在星期天，于是它得到那张七年周历；
 * 《戏说封神》19 期挤在两个月里，于是它没有，只有正文。
 *
 * 另一条：这一页的主体是**她的标题**，不是表格。243 期标题从
 * 「【心灵砒霜】2016.8.7直播音频」一路变成「长远规划？生活主打一个失控！」，
 * 这个演变本身就是内容，所以它按正文的字号排，不是 13px 的列表行。
 */
export default async function SeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ds = getDataset()
  const series = ds.series.get(id)
  if (!series) notFound()

  const stats = buildSeriesStats(ds).find((s) => s.id === id)!
  const game = series.game ? ds.games.get(series.game) : undefined
  const ascending = [...stats.entries].reverse()
  const first = ascending[0]
  const last = ascending[ascending.length - 1]

  /*
   * 一档节目停掉的时候，那个时期是不是也快到头了。
   *
   * 《心灵砒霜》最后一期 2023-11-26，四天之后 2023-11-30 是《66聊聊》——
   * 斗鱼时期的最后一场。这两条挨在一起本身就是全部的内容，不需要任何旁白。
   *
   * 注意这里算的**不是"下一条记录"**：下一条只会拿到 11-27 那场普通直播，
   * 那种相邻是随机的，什么也没说。要说的是"它是跟着一个时代一起结束的"，
   * 所以取的是它所在时期的最后一场，而且只在真的紧挨着（90 天内）时才显示。
   */
  const all = toTimelineEntries(ds)
  const endingEra = last ? eraOf(last.date) : null
  const eraFinale = endingEra
    ? [...all]
        .filter((e) => eraOf(e.date).id === endingEra.id)
        .sort((a, b) => b.date.localeCompare(a.date))[0]
    : undefined
  const finaleGap = eraFinale && last ? daysBetween(last.date, eraFinale.date) : -1
  const showFinale = Boolean(eraFinale && last && eraFinale.id !== last.id && finaleGap > 0 && finaleGap <= 90)

  const useCalendar = Boolean(stats.dominantWeekday) && stats.entryCount >= 20
  const calendar = useCalendar ? buildSeriesCalendar(stats) : []

  return (
    <main className="ui-page-in mx-auto max-w-[1000px] px-4 pb-24 sm:px-6">
      <header className="flex items-center py-5">
        <SiteNav active="series" />
      </header>
      <Link href="/series/" className="ui-press mt-4 inline-block rounded-sm font-mono text-[11px] text-muted underline underline-offset-4 hover:text-live">
        ← 回到系列列表
      </Link>

      <header className="mt-6">
        <h1 className="text-[30px] font-semibold leading-tight sm:text-[42px]">{series.name}</h1>

        {stats.entryCount > 0 && (
          <p className="mt-5 max-w-2xl text-[19px] font-medium leading-[1.9] text-ink sm:text-[24px]">
            {stats.firstDate.slice(0, 4) === stats.lastDate.slice(0, 4)
              ? `${stats.firstDate.slice(0, 4)} 年，`
              : `${stats.firstDate.slice(0, 4)} 到 ${stats.lastDate.slice(0, 4)}，`}
            <span className="tnum">{stats.entryCount}</span> 期
            {stats.dominantWeekday && (
              <>
                ，其中 <span className="text-live tnum">{stats.dominantWeekday.count}</span> 期在星期
                {WEEKDAY_CN[stats.dominantWeekday.day]}
              </>
            )}
            。
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted tnum">
          {stats.entryCount > 0 && <span>{stats.firstDate} → {stats.lastDate}</span>}
          {game && (
            <>
              <span className="text-line">·</span>
              <Link href={`/games/${game.id}/`} className="text-live underline underline-offset-4">
                {game.name} →
              </Link>
            </>
          )}
        </div>

        {/* 考证说明留在这里，紧挨着它说明的东西——不是横幅，也不删。 */}
        {series.description && (
          <p className="mt-6 max-w-2xl border-l border-line pl-4 text-[12px] leading-7 text-faint">
            {series.description}
          </p>
        )}
      </header>

      {stats.entryCount === 0 ? (
        <p className="mt-10 text-[13px] text-muted">这个系列已经定义，但还没有场次被明确归入。</p>
      ) : (
        <>
          {useCalendar && (
            <section className="mt-16">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                每一格是一天，亮着的是有一期的那天
              </h2>
              <div className="mt-5">
                <SeriesCalendar years={calendar} highlightWeekday={stats.dominantWeekday?.day} />
              </div>
            </section>
          )}

          {/* 两端：第一期和最后一期，各给一张真封面。 */}
          <section className="mt-16 grid gap-8 sm:grid-cols-2">
            <Bookend entry={first} label="第一期" />
            {last && last.id !== first?.id && <Bookend entry={last} label="最后一期" />}
          </section>

          {/* 它是跟着一个时代一起结束的。 */}
          {showFinale && eraFinale && endingEra && (
            <section className="mt-12 border-l-2 pl-5" style={{ borderColor: endingEra.color }}>
              <p className="font-mono text-[11px] text-faint tnum">
                {finaleGap} 天之后，{endingEra.name}的最后一场——
              </p>
              <Link
                href={`/e/${eraFinale.id}/`}
                className="ui-press mt-2 inline-block rounded-sm text-[17px] leading-relaxed text-ink underline-offset-4 hover:text-live hover:underline sm:text-[20px]"
              >
                {eraFinale.date} 《{eraFinale.title}》
              </Link>
            </section>
          )}

          {/* 全部期数。按正文排，不是表格——标题的演变本身就是要读的东西。 */}
          <section className="mt-20">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
              全部 {stats.entryCount} 期 · 标题原文
            </h2>
            <ol className="mt-6">
              {ascending.map((e, i) => {
                const year = e.date.slice(0, 4)
                const newYear = i === 0 || ascending[i - 1].date.slice(0, 4) !== year
                const platform = PLATFORM_META[e.platform as Platform]
                return (
                  <li key={e.id}>
                    {newYear && (
                      <p
                        className="mb-3 mt-9 border-t border-line pt-3 font-mono text-[13px] tnum first:mt-0"
                        style={{ color: eraOf(e.date).color }}
                      >
                        {year}
                      </p>
                    )}
                    <Link
                      href={`/e/${e.id}/`}
                      className="ui-press group flex flex-wrap items-baseline gap-x-3 rounded-sm py-1.5"
                    >
                      <span className="w-[46px] shrink-0 font-mono text-[11px] text-faint tnum">
                        {e.date.slice(5)}
                      </span>
                      <span className="w-4 shrink-0 font-mono text-[10px] text-faint">
                        {WEEKDAY_CN[new Date(`${e.date}T00:00:00Z`).getUTCDay()]}
                      </span>
                      <span className="min-w-0 flex-1 text-[15px] leading-relaxed text-ink group-hover:text-live sm:text-[16px]">
                        {e.title}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-faint">
                        {platform?.name ?? e.platform}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ol>
          </section>
        </>
      )}
    </main>
  )
}

function Bookend({ entry, label }: { entry?: TimelineEntry; label: string }) {
  if (!entry) return null
  const era = eraOf(entry.date)
  return (
    <Link href={`/e/${entry.id}/`} className="ui-press group block">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: era.color }}>
          {label}
        </span>
        <span className="font-mono text-[11px] text-faint tnum">{entry.date}</span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={proxyImage(entry.cover ?? undefined, 640) ?? ''}
        alt=""
        referrerPolicy="no-referrer"
        className="mt-3 aspect-video w-full bg-raised object-cover"
      />
      <p className="mt-3 text-[16px] font-medium leading-relaxed text-ink group-hover:text-live sm:text-[19px]">
        {entry.title}
      </p>
    </Link>
  )
}
