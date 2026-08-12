import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { RotatingAvatar } from '@/components/RotatingAvatar'
import { TimelineProgress } from '@/components/TimelineProgress'
import { ActSection } from '@/components/ActSection'
import { Interlude } from '@/components/Interlude'
import { HighlightStrip } from '@/components/HighlightStrip'
import { HomeStats } from '@/components/HomeStats'
import { GameCard } from '@/components/GameCard'
import type { GameCardData } from '@/components/GameShelf'
import { RandomMemory, type MemoryCandidate } from '@/components/RandomMemory'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { CURATED_GAMES, getGameProfile, resolveHomepage } from '@/lib/narrative'

/**
 * 首页 = 三幕 + 幕间 + 高光 + 记忆（随机一晚 / 今日今夕）+ 游戏预告 + 四个房间入口。
 * 第一屏只有人，没有数字（数字在第二屏「这一切加起来」）；
 * 一切计数来自 resolveHomepage 的构建期派生，文案不硬编码数字。
 * 「今日今夕」以构建日期为准（静态站约束），框架为「N 年前的这几天」。
 */
export default function HomePage() {
  const ds = getDataset()
  const timeline = toTimelineEntries(ds)
  const data = resolveHomepage(ds, timeline)

  // 随机记忆池：有封面 / 有游戏 / 有栏目 的条目才配进入（宁缺毋滥）。
  // 全时间线等距抽样（最多 400 条）——不偏向任何时期，构建期确定，无随机数。
  const meaningful = timeline.filter((e) => e.cover || e.games.length > 0 || e.seriesName)
  const step = Math.max(1, Math.ceil(meaningful.length / 400))
  const memoryPool: MemoryCandidate[] = meaningful
    .filter((_, i) => i % step === 0)
    .map((e) => ({ id: e.id, date: e.date, title: e.title }))

  // 今日今夕：构建日 ±3 天里离今天最近的记录
  const today = new Date()
  const todayMd = today.getMonth() * 100 + today.getDate()
  let todayMemory: { entry: (typeof timeline)[number]; yearsAgo: number; distance: number } | null = null
  for (const e of timeline) {
    const [y, m, d] = e.date.split('-').map(Number)
    if (!y || !m || !d) continue
    const dist = Math.min(Math.abs(m * 100 + d - todayMd), 366 - Math.abs(m * 100 + d - todayMd))
    if (dist > 3) continue
    const yearsAgo = today.getFullYear() - y
    if (!todayMemory || dist < todayMemory.distance || (dist === todayMemory.distance && y > Number(todayMemory.entry.date.slice(0, 4)))) {
      todayMemory = { entry: e, yearsAgo, distance: dist }
    }
  }

  // 游戏预告：有场次的游戏按时长取前 8
  const ids = [...ds.games.keys(), ...Object.keys(CURATED_GAMES)]
  const gamePreview: GameCardData[] = ids
    .map((id) => getGameProfile(ds, timeline, id))
    .filter((p): p is NonNullable<typeof p> => p !== null && p.sessions > 0)
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      name: p.name,
      cover: p.cover,
      sessions: p.sessions,
      totalMinutes: p.totalMinutes,
      hoursLabel: p.hoursLabel,
      firstDate: p.firstDate,
      lastDate: p.lastDate,
      curated: Boolean(p.curated),
    }))

  const actI = data.acts.find((a) => a.act.id === 'act-i')!
  const actII = data.acts.find((a) => a.act.id === 'act-ii')!
  const actIII = data.acts.find((a) => a.act.id === 'act-iii')!

  return (
    <main className="ui-page-in min-h-screen overflow-hidden">
      <TimelineProgress />

      <header className="ui-slide-down relative z-20 mx-auto flex max-w-[1240px] items-center justify-between px-4 py-5 sm:px-6">
        <SiteNav active="home" />
        <Link href="/chronicle/" className="ui-press hidden rounded-sm font-mono text-[11px] text-live underline-offset-4 hover:underline sm:block">
          打开全部 {data.totals.entries.toLocaleString()} 条记录 →
        </Link>
      </header>

      {/* 第一屏：人物，不是数据。数字挪去第二屏（HomeStats）。
          移动端收进 80svh 左右（内容驱动，min-height 只是下限），保证下一幕露出一角。 */}
      <section className="relative mx-auto flex min-h-[70vh] min-h-[80svh] w-full max-w-[1240px] flex-col justify-center px-4 pb-10 pt-12 sm:px-6 sm:pb-24 sm:pt-20">
        <div className="pointer-events-none absolute -right-24 -top-40 h-[520px] w-[520px] rounded-full bg-live/10 blur-[100px]" />
        <div className="pointer-events-none absolute -left-44 top-24 h-[460px] w-[460px] rounded-full bg-today/10 blur-[110px]" />
        <div className="relative grid w-full gap-10 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:gap-12">
          <div className="ui-reveal">
            <div className="inline-flex items-center gap-2 rounded-full border border-live/30 bg-live/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-live">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-live" />
              2010 — {data.now.year} · 还在继续
            </div>
            <p className="mt-7 font-mono text-[11px] uppercase tracking-[0.28em] text-faint">女流 66 · 石悦</p>
            <h1 className="mt-3 text-[64px] font-bold leading-[1.0] tracking-[-0.04em] text-ink sm:text-[92px]">女流</h1>
            <p className="mt-6 max-w-xl text-[15px] leading-8 text-muted">
              十六年的游戏、直播和那些晚上，<br className="hidden sm:block" />
              重新连成一条路。
            </p>
            <div className="mt-7 flex flex-wrap gap-3 sm:mt-9">
              <a
                href="#act-i"
                className="ui-press group rounded-full bg-ink px-6 py-3 text-[13px] font-medium text-base hover:shadow-[0_16px_50px_rgba(230,228,239,0.12)]"
              >
                开始 <span className="ml-2 inline-block transition-transform group-hover:translate-y-0.5">↓</span>
              </a>
              <Link href="/chronicle/" className="ui-press rounded-full border border-line bg-surface/60 px-6 py-3 text-[13px] text-muted hover:border-muted hover:text-ink">
                打开编年史
              </Link>
            </div>
          </div>

          <div className="ui-reveal ui-delay-1 relative mx-auto aspect-square w-full max-w-[300px] sm:max-w-[440px]">
            <div className="absolute inset-[8%] animate-[spin_35s_linear_infinite] rounded-full border border-dashed border-line" />
            <div className="absolute inset-[22%] animate-[spin_24s_linear_infinite_reverse] rounded-full border border-live/20" />
            <div className="absolute inset-[34%] rounded-full bg-gradient-to-br from-live/25 via-raised to-today/20 shadow-[0_0_90px_rgba(91,200,232,0.16)]" />
            <div className="absolute inset-0 flex items-center justify-center text-center">
              <div className="relative h-[38%] w-[38%] overflow-hidden rounded-full border-4 border-base/80 shadow-[0_0_35px_rgba(91,200,232,0.24)] ring-1 ring-live/40">
                <RotatingAvatar />
              </div>
            </div>
            {[['12%', '48%', '#E0A244'], ['78%', '18%', '#5BC8E8'], ['83%', '72%', '#FF6B75'], ['25%', '82%', '#A78BFA']].map(([left, top, color], index) => (
              <span key={index} className="absolute h-3 w-3 rounded-full shadow-[0_0_20px_currentColor]" style={{ left, top, color, background: color }} />
            ))}
          </div>
        </div>
      </section>

      {/* 三幕。幕间本身就是设计。 */}
      <ActSection act={actI} index={0} />
      <ActSection act={actII} index={1} />
      <Interlude count={data.interlude.count} loneEntry={data.interlude.loneEntry} />
      <ActSection act={actIII} index={2} now={{ year: data.now.year, label: data.now.label, count: data.now.count }} />

      <HighlightStrip beats={data.highlights} />

      {/* 记忆：随机一晚 + 今日今夕 */}
      <section className="border-t border-line bg-surface/15">
        <div className="mx-auto max-w-[1240px] px-4 py-14 sm:px-6 sm:py-20">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">Memory · 记忆盒</p>
          <h2 className="mt-3 text-[24px] font-semibold tracking-tight text-ink sm:text-[32px]">回到过去，只需要一晚。</h2>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <RandomMemory pool={memoryPool} />
            <TodayInHistory
              title={todayMemory?.entry.title ?? null}
              date={todayMemory?.entry.date ?? null}
              yearsAgo={todayMemory?.yearsAgo ?? null}
              href={todayMemory ? `/e/${todayMemory.entry.id}/` : null}
              yearHref={todayMemory ? `/chronicle/?y=${todayMemory.entry.date.slice(0, 4)}` : null}
            />
          </div>
        </div>
      </section>

      {/* 游戏预告 */}
      {gamePreview.length > 0 && (
        <section className="border-t border-line">
          <div className="mx-auto max-w-[1240px] px-4 py-14 sm:px-6 sm:py-20">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-video">Games · 玩过的游戏</p>
                <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-ink sm:text-[28px]">陪得最久的几款。</h2>
              </div>
              <Link href="/games/" className="ui-press rounded-sm font-mono text-[11px] text-live underline underline-offset-4">
                全部游戏 →
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              {gamePreview.map((p) => (
                <GameCard key={p.id} profile={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 四个房间 */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-[1240px] px-4 py-14 sm:px-6 sm:py-20">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">Rooms · 四个房间</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <RoomLink href="/chronicle/" color="#5BC8E8" kicker="Chronicle" title="编年史" body="走过的路，一条一条。故事模式先看，档案模式逐条查。" />
            <RoomLink href="/series/" color="#A78BFA" kicker="Series" title="节目" body="固定出现过的栏目——心灵砒霜，和更早的连载。" />
            <RoomLink href="/stats/" color="#E5568A" kicker="Stats" title="数据" body="五个问题，五个答案。数字全部从档案派生。" />
            <RoomLink href="/gallery/" color="#FF6B75" kicker="Gallery" title="画廊" body="被画下来的几年。水友替每个年份留下的注脚。" />
          </div>
        </div>
      </section>

      <HomeStats data={data} />

      <footer className="mx-auto flex max-w-[1240px] flex-col justify-between gap-4 px-4 py-10 font-mono text-[10px] text-faint sm:flex-row sm:px-6">
        <span>只索引，不搬运 · 所有播放回到原平台</span>
        <Link href="/contact/" className="ui-press rounded-sm transition-colors hover:text-live">资料纠错与联系 →</Link>
      </footer>
    </main>
  )
}

/** 今日今夕：离今天（±3 天）最近的一条历史记录。构建期派生，静态站约束如实标注。 */
function TodayInHistory({
  title,
  date,
  yearsAgo,
  href,
  yearHref,
}: {
  title: string | null
  date: string | null
  yearsAgo: number | null
  href: string | null
  yearHref: string | null
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-line/80 bg-surface/25 p-6 sm:p-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">Today in history</p>
      <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-ink sm:text-[26px]">
        {title ? (
          <>
            这些天的历史上，{yearsAgo === 0 ? '今年' : `${yearsAgo} 年前`}：
          </>
        ) : (
          '这几天，档案里暂时没有记录。'
        )}
      </h2>
      {title && href && (
        <Link href={href} className="ui-press group mt-5">
          <div className="rounded-xl border border-line/80 bg-surface/50 p-4 transition-colors hover:border-muted/70">
            <p className="font-mono text-[10px] text-faint tnum">{date}</p>
            <p className="mt-1.5 text-[14px] font-medium leading-snug text-ink transition-colors group-hover:text-white">{title}</p>
            <p className="mt-2 font-mono text-[10px] text-live">打开这一天 →</p>
          </div>
        </Link>
      )}
      {yearHref && (
        <p className="mt-4 font-mono text-[10px] text-faint/70">
          <Link href={yearHref} className="rounded-sm underline underline-offset-4 transition-colors hover:text-live">
            看那年全部记录 →
          </Link>
          <span className="ml-2">ⓘ 以构建日期为准（静态站约束）</span>
        </p>
      )}
    </div>
  )
}

/** 四个房间的入口瓦片 */
function RoomLink({ href, color, kicker, title, body }: { href: string; color: string; kicker: string; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="ui-card ui-press group flex flex-col rounded-2xl border border-line/80 bg-surface/40 p-6 transition-colors hover:border-muted/60"
    >
      <p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color }}>
        <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {kicker}
      </p>
      <h3 className="mt-4 text-[20px] font-semibold tracking-tight text-ink transition-colors group-hover:text-white">{title}</h3>
      <p className="mt-2 text-[13px] leading-6 text-muted">{body}</p>
      <span className="mt-auto pt-4 font-mono text-[11px] text-faint/60 transition-transform group-hover:translate-x-1" style={{ color }}>
        进入 →
      </span>
    </Link>
  )
}
