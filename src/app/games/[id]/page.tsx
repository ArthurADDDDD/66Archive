import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteNav } from '@/components/SiteNav'
import { BackToTop, MobileQuickNav } from '@/components/ScrollAffordances'
import { RelatedRail } from '@/components/RelatedRail'
import { SiteFooter } from '@/components/primitives'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { actColorForDate, CURATED_GAMES, getGameProfile } from '@/lib/narrative'
import { buildGameRails } from '@/lib/relations'
import { formatDuration } from '@/lib/ui'

/**
 * 游戏详情（Slice B 核心）。
 * 第一屏先问「这款游戏和女流之间发生过什么？」，数据在第二屏。
 * 注册游戏走 games 字段统计；策展游戏（CURATED_GAMES）走标题匹配——
 * 只有策展名单里的 id 允许标题匹配，禁止全库猜标题。
 */
export const dynamicParams = false

export function generateStaticParams() {
  const ds = getDataset()
  return [...ds.games.keys(), ...Object.keys(CURATED_GAMES)].map((id) => ({ id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = getGameProfile(getDataset(), toTimelineEntries(getDataset()), id)
  return { title: profile ? `${profile.name} · 游戏收藏架` : '游戏 · 女流66编年史' }
}

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ds = getDataset()
  const timeline = toTimelineEntries(ds)
  const profile = getGameProfile(ds, timeline, id)
  if (!profile) notFound()

  const rails = buildGameRails(profile, ds)

  const yearCounts = new Map<string, { count: number; anchorDate: string }>()
  for (const e of profile.entries) {
    const y = e.date.slice(0, 4)
    const row = yearCounts.get(y)
    if (row) {
      row.count += 1
      if (e.date > row.anchorDate) row.anchorDate = e.date
    } else {
      yearCounts.set(y, { count: 1, anchorDate: e.date })
    }
  }
  const yearRows = [...yearCounts.entries()].sort()
  const maxYearCount = Math.max(1, ...yearRows.map(([, r]) => r.count))

  const ctaHref = profile.curated
    ? `/chronicle/?q=${encodeURIComponent(profile.name)}`
    : `/chronicle/?g=${profile.id}`

  // 稀疏游戏（场次 <= 1）：紧凑 hero——只留下一个晚上，不硬凑 4 个指标和年份分布。
  const sparse = profile.sessions <= 1

  return (
    <main className="ui-page-in min-h-screen overflow-x-clip">
      <MobileQuickNav active="games" />
      <BackToTop />
      <header className="ui-slide-down relative z-20 site-header-container flex items-center justify-between px-4 py-5 sm:px-6">
        <SiteNav active="games" />
        <Link href="/games/" className="ui-press hidden rounded-sm text-meta text-live sm:block">
          ← 游戏收藏架
        </Link>
      </header>

      {/* 第一屏：先问发生过什么，数据在后面 */}
      <section className="relative site-container px-page pb-16 pt-14 sm:pb-24 sm:pt-20">
        {sparse ? (
          <SparseHero profile={profile} />
        ) : (
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
            <div>
              <p className="text-meta uppercase tracking-[0.16em] text-video">{profile.name} · 游戏收藏架</p>
              <h1 className="mt-4 max-w-2xl text-h1 font-semibold">这款游戏和女流之间，发生过什么？</h1>
              {profile.oneLiner ? (
                <p className="mt-5 max-w-xl text-body text-muted">{profile.oneLiner}</p>
              ) : (
                <p className="mt-5 max-w-xl text-body text-muted">
                  {profile.sessions > 0
                    ? `从 ${profile.firstDate} 到 ${profile.lastDate}，档案里记下了 ${profile.sessions} 场，加起来 ${profile.hoursLabel}。`
                    : `档案里还没有标记过《${profile.name}》的场次。`}
                </p>
              )}
              {profile.sessions === 0 && (
                <p className="mt-4 text-meta text-faint">
                  ⓘ 游戏字段仍在补录中；也可以去编年史直接搜「{profile.name}」。
                </p>
              )}
              {profile.curated?.note && (
                <p className="mt-4 text-meta text-faint">ⓘ {profile.curated.note}</p>
              )}
            </div>

            <div className="relative aspect-video overflow-hidden rounded-xl border border-line/80 bg-surface/40">
              {profile.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.cover} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-video/15 via-raised to-live/10 p-8">
                  <span className="text-center text-h2 font-bold text-ink/85">
                    {profile.name}
                  </span>
                </div>
              )}
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-base/45 via-transparent to-transparent" />
              {profile.entries.length > 0 && (
                <span className="absolute bottom-3 left-3 rounded-sm bg-base/70 px-2 py-1 text-meta text-ink/90 tnum backdrop-blur-sm">
                  {profile.sessions} 场 · {profile.hoursLabel}
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 第二屏：指标（在问题之后，而非之前）；稀疏游戏跳过 */}
      {!sparse && profile.sessions > 0 && (
        <section className="border-t border-line bg-surface/25 py-14 sm:py-20">
          <div className="site-container px-page">
            <p className="text-meta uppercase tracking-[0.16em] text-faint">数字 · 只统计已标记的场次</p>
            <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat value={profile.hoursLabel} label="总时间" />
              <Stat value={profile.sessions.toLocaleString()} label="场次" />
              <Stat value={profile.firstDate ?? '—'} label="首次" />
              <Stat value={profile.lastDate ?? '—'} label="最后" />
            </dl>
            <div className="mt-10 max-w-xl">
              <p className="text-meta uppercase tracking-[0.16em] text-faint">年份分布</p>
              <div className="mt-3 space-y-2">
                {yearRows.map(([year, row]) => (
                  <div key={year} className="flex items-center gap-3">
                    <span className="w-10 shrink-0 font-mono text-meta text-faint tnum">{year}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${(row.count / maxYearCount) * 100}%`, background: actColorForDate(row.anchorDate) }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-meta text-faint tnum">{row.count} 场</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 这些晚上：每条都通向编年史条目 */}
      {profile.entries.length > 0 && (
        <section className="border-t border-line py-14 sm:py-20">
          <div className="site-container px-page">
            <p className="text-meta uppercase tracking-[0.16em] text-faint">Sessions · 这些晚上</p>
            <h2 className="mt-2 text-h3 font-semibold text-ink">档案里的相关场次</h2>
            <ul className="mt-6 divide-y divide-line/60 border-y border-line/60">
              {profile.entries.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/e/${e.id}/`}
                    className="group flex items-baseline gap-3 py-3 transition-colors hover:bg-surface/30"
                  >
                    <span className="w-[104px] shrink-0 font-mono text-meta text-faint tnum">{e.date}</span>
                    <span className="min-w-0 flex-1 truncate text-body text-muted group-hover:text-ink">{e.title}</span>
                    {e.duration_min != null && (
                      <span className="shrink-0 text-meta text-faint tnum">{formatDuration(e.duration_min)}</span>
                    )}
                    <span aria-hidden className="shrink-0 font-mono text-meta text-faint/70 transition-transform group-hover:translate-x-1 group-hover:text-live">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link
                href={ctaHref}
                className="ui-press group inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-control font-medium text-base hover:shadow-[0_16px_50px_rgba(230,228,239,0.12)]"
              >
                在编年史里查看全部相关记录
                <span className="font-mono text-meta transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </div>
          </div>
        </section>
      )}

      <RelatedRail rails={rails} />

      <SiteFooter />
    </main>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="font-mono text-h3 font-bold text-ink tnum">{value}</dt>
      <dd className="mt-1 text-meta uppercase tracking-[0.16em] text-faint">{label}</dd>
    </div>
  )
}

/** 稀疏游戏（场次 <= 1）：紧凑 hero——游戏名 / 日期 / 「只留下一个晚上」/ 封面 / 一场的完整信息。 */
function SparseHero({ profile }: { profile: NonNullable<ReturnType<typeof getGameProfile>> }) {
  const hasEntry = profile.sessions > 0
  return (
    <div className="max-w-3xl">
      <p className="text-meta uppercase tracking-[0.16em] text-video">{profile.name} · 游戏收藏架</p>
      <h1 className="mt-3 text-h1 font-semibold text-ink">{profile.name}</h1>
      <p className="mt-3 text-body text-muted">
        {hasEntry
          ? <>
            只留下一个晚上。{profile.firstDate}，{profile.hoursLabel}。
          </>
          : <>档案里还没有标记过《{profile.name}》的场次。</>}
      </p>

      <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start">
        {profile.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.cover}
            alt={`${profile.name} 封面`}
            referrerPolicy="no-referrer"
            className="aspect-video w-full max-w-[26.25rem] rounded-xl border border-line/80 bg-raised object-cover"
          />
        ) : (
          <div className="flex aspect-video w-full max-w-[26.25rem] items-center justify-center rounded-xl border border-line/80 bg-raised p-8">
            <span className="text-center text-h3 font-bold text-ink/85">{profile.name}</span>
          </div>
        )}
        {hasEntry && (
          <dl className="space-y-1.5 text-meta text-faint tnum">
            <div>
              <dt className="inline text-faint">场次 · </dt>
              <dd className="inline text-ink">{profile.sessions} 场</dd>
            </div>
            <div>
              <dt className="inline text-faint">时长 · </dt>
              <dd className="inline text-ink">{profile.hoursLabel}</dd>
            </div>
            <div>
              <dt className="inline text-faint">日期 · </dt>
              <dd className="inline text-ink">{profile.firstDate}</dd>
            </div>
            <p className="pt-1 text-faint">首次就是最后一场——档案里只此一次。</p>
          </dl>
        )}
      </div>

      {!hasEntry && (
        <p className="mt-4 text-meta text-faint">
          ⓘ 游戏字段仍在补录中；也可以去编年史直接搜「{profile.name}」。
        </p>
      )}
      {profile.curated?.note && (
        <p className="mt-4 text-meta text-faint">ⓘ {profile.curated.note}</p>
      )}
    </div>
  )
}
