import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteNav } from '@/components/SiteNav'
import { getDataset } from '@/lib/data'
import { buildGameStats, formatBoarding, formatGameDuration, formatHours, gameFace, gameSegments } from '@/lib/game-stats'
import type { GameSegment } from '@/lib/game-stats'
import { eraOf } from '@/lib/covers'
import { PLATFORM_META, proxyImage, withTimestamp } from '@/lib/platforms'
import { formatDuration } from '@/lib/ui'
import { toSeconds, type Platform } from '@/lib/schema'
import type { GameStats } from '@/lib/game-stats'

export function generateStaticParams() {
  return [...getDataset().games.values()].map((g) => ({ id: g.id }))
}

/**
 * 游戏详情页。
 *
 * 旧版第一屏是一张"按年出场"的柱状图。柱状图回答的是分析师的问题（"产出趋势如何"），
 * 而她的问题是"真的吗"。所以这一版第一屏是四句话，全部是算出来的：
 *
 *   第一次是哪天，标题写的是什么
 *   最后一次是哪天
 *   中间玩得最凶的那几天
 *   她是什么时候上车的（需要 games.yaml 的 released，没填就整行不出现）
 *
 * 这四句里最值钱的是"隔了 2,370 天，她又打开了它"——而它的形式，就是主机库里的
 * "Last played"。别把它降级成一个角标或者 tooltip。
 */
export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ds = getDataset()
  const game = ds.games.get(id)
  if (!game) notFound()

  const stats = buildGameStats(ds).find((g) => g.id === id)!
  const face = gameFace(stats)
  const boarding = formatBoarding(stats.daysFromRelease)

  // 分段里跟这个游戏有关的标签：boss 名、环节名。全站技术含量最高的那份数据，
  // 在游戏页上就该被当成"她打过的东西"直接读出来（黑魂 3 那 30 个 boss 名就在这里）。
  const segments = gameSegments(ds, id)

  return (
    <main className="ui-page-in mx-auto max-w-[1100px] px-4 pb-24 sm:px-6">
      <header className="flex items-center py-5">
        <SiteNav active="games" />
      </header>
      <Link href="/games/" className="ui-press mt-4 inline-block rounded-sm font-mono text-[11px] text-muted underline underline-offset-4 hover:text-live">
        ← 回到游戏库
      </Link>

      <header className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,320px)_1fr] sm:items-start sm:gap-8">
        {face && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxyImage(face, 640) ?? ''}
            alt=""
            referrerPolicy="no-referrer"
            className="aspect-video w-full bg-raised object-cover"
          />
        )}
        <div>
          <h1 className="text-[28px] font-semibold leading-tight sm:text-[38px]">{game.name}</h1>
          {game.aliases.length > 0 && <p className="mt-2 text-[12px] text-faint">又名：{game.aliases.join(' · ')}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12px] text-muted tnum">
            <span>{stats.sessionCount} 场</span>
            <span className="text-line">·</span>
            <span>{formatGameDuration(stats.knownDurationMin, stats.knownDurationCount, stats.sessionCount)}</span>
            {stats.spanDays > 0 && (
              <>
                <span className="text-line">·</span>
                <span>跨度 {stats.spanDays.toLocaleString()} 天</span>
              </>
            )}
          </div>
          {game.note && <p className="mt-4 text-[12px] leading-6 text-faint">{game.note}</p>}
          {face && !stats.cover && (
            <p className="mt-4 font-mono text-[10px] text-faint">上面这张，是她第一次播它那天的截图。</p>
          )}
        </div>
      </header>

      {stats.sessionCount === 0 ? (
        <p className="mt-10 text-[13px] text-muted">
          这个游戏已经登记在游戏库里，但还没有场次打上对应标签。如果你手上有相关直播 / 视频的线索，欢迎
          <Link href="/contact/" className="mx-1 text-live underline underline-offset-4">提供补录</Link>
          。
        </p>
      ) : (
        <>
          {/* 四句话。 */}
          <section className="mt-14 space-y-10 border-t border-line pt-10">
            {stats.first && (
              <Sentence lead="第一次" date={stats.first.date} entryId={stats.first.id} title={stats.first.title} />
            )}

            {stats.comeback && (
              <div>
                <p className="text-[20px] font-medium leading-[1.8] text-ink sm:text-[26px]">
                  中间隔了{' '}
                  <span className="text-video tnum">{stats.comeback.gapDays.toLocaleString()} 天</span>
                  ，然后她又打开了它。
                </p>
                <Link
                  href={`/e/${stats.comeback.after.id}/`}
                  className="ui-press mt-3 inline-block rounded-sm text-[15px] leading-relaxed text-muted underline-offset-4 hover:text-live hover:underline"
                >
                  {stats.comeback.after.date} 《{stats.comeback.after.title}》
                </Link>
              </div>
            )}

            {stats.binge && stats.binge.sessions >= 4 && (
              <div>
                <p className="text-[20px] font-medium leading-[1.8] text-ink sm:text-[26px]">
                  打得最凶的是{' '}
                  <span className="tnum">{stats.binge.from}</span> 到 <span className="tnum">{stats.binge.to}</span>，
                  <span className="tnum">{stats.binge.spanDays}</span> 天里播了{' '}
                  <span className="text-live tnum">{stats.binge.sessions} 场</span>
                  {stats.binge.knownMinutes > 0 && <>，{formatHours(stats.binge.knownMinutes)}</>}。
                </p>
              </div>
            )}

            {stats.last && stats.last.id !== stats.first?.id && (
              <Sentence lead="最后一次" date={stats.last.date} entryId={stats.last.id} title={stats.last.title} />
            )}

            {/* 发售日这一层：games.yaml 填了 released 才出现。没填就没有，不猜。 */}
            {boarding && (
              <p className="text-[20px] font-medium leading-[1.8] text-ink sm:text-[26px]">
                {game.released} 发售，<span className="text-now">{boarding}</span>。
              </p>
            )}
          </section>

          {segments.length > 0 && <Segments segments={segments} entries={stats} />}

          <section className="mt-16">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
              全部 {stats.entries.length} 场
            </h2>
            <ul className="mt-4 grid gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {stats.entries.map((e) => {
                const platform = PLATFORM_META[e.platform as Platform]
                const era = eraOf(e.date)
                return (
                  <li key={e.id}>
                    <Link href={`/e/${e.id}/`} className="ui-press group block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={proxyImage(e.cover ?? undefined, 480) ?? ''}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="aspect-video w-full bg-raised object-cover"
                      />
                      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 font-mono text-[10px] text-faint tnum">
                        <span style={{ color: era.color }}>{e.date}</span>
                        <span>{platform?.name ?? e.platform}</span>
                        <span>{formatDuration(e.duration_min)}</span>
                      </p>
                      <p className="mt-1 text-[13px] leading-snug text-ink group-hover:text-live">{e.title}</p>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}
    </main>
  )
}

function Sentence({ lead, date, entryId, title }: { lead: string; date: string; entryId: string; title: string }) {
  return (
    <div>
      <p className="text-[20px] font-medium leading-[1.8] text-ink sm:text-[26px]">
        {lead}是 <span className="tnum">{date}</span>，标题是——
      </p>
      <Link
        href={`/e/${entryId}/`}
        className="ui-press mt-3 inline-block rounded-sm text-[17px] leading-relaxed text-muted underline-offset-4 hover:text-live hover:underline sm:text-[19px]"
      >
        《{title}》
      </Link>
    </div>
  )
}

/**
 * 分段标签。这些是数据里最"没人会整理"的一层——`灰烬审判者古达P1`、`冷冽谷的波尔多P2`——
 * 所以它们值得被原样列出来，而不是折叠进详情页的进度条里。每一条点开跳到原视频对应的秒数。
 */
function Segments({ segments, entries }: { segments: GameSegment[]; entries: GameStats }) {
  const urlOf = new Map(entries.entries.map((e) => [e.id, e.primaryUrl]))

  return (
    <section className="mt-16">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
        分段里记下的 {segments.length} 个名字 · 点一下跳到原视频对应的那一秒
      </h2>
      <ul className="mt-4 flex flex-wrap gap-x-3 gap-y-2">
        {segments.map((s, i) => {
          const url = urlOf.get(s.entryId)
          const href = url ? withTimestamp(url, toSeconds(s.at)) : `/e/${s.entryId}/`
          const external = Boolean(url)
          return (
            <li key={`${s.entryId}-${i}`}>
              <a
                href={href}
                {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                title={`${s.date} ${s.at}`}
                className="ui-press inline-flex items-baseline gap-1.5 rounded-full border border-line px-2.5 py-1 text-[12px] text-muted hover:border-muted hover:text-ink"
              >
                <span className="font-mono text-[9px] text-faint tnum">{s.date.slice(2)}</span>
                {s.label}
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
