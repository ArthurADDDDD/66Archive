import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { CoverWall } from '@/components/CoverWall'
import { EraRow } from '@/components/EraRow'
import { GameShelf } from '@/components/GameShelf'
import { MemoryShelf } from '@/components/MemoryShelf'
import { buildArchiveFacts, buildArchivists, buildCoverWall, selfDescription } from '@/lib/archive'
import { buildEraIntros } from '@/lib/eras-intro'
import { buildGameShelf } from '@/lib/game-shelf'
import { buildHighlights } from '@/lib/highlights'
import { AVATARS } from '@/lib/avatars'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { getGalleryCollection } from '@/lib/gallery'
import { PLATFORM_META } from '@/lib/platforms'
import type { Platform } from '@/lib/schema'

/**
 * 首页。
 *
 * **这一版返工过两次，两次返工的理由都比结论重要。**
 *
 * 第一版第一屏直接铺了 260 张封面——方向对（画面先于数据），顺序错：
 * 一面等权的墙，第一眼给人的是"哇好多视频"，是数据量，不是记忆。
 *
 * 第二版把墙挪到第二屏，第一屏改成六张"公式选出来的"时刻（最早一条 / 最长沉默 /
 * 最长单场……）。逻辑很干净，但一个真正认识她的人会问："156277 呢？心灵砒霜呢？"
 * ——纯公式答不出这些问题，因为它们重要不是因为"数据异常"，是因为**认识她的人
 * 才知道该往哪儿看**。而且第二版整页都是直播截图，完全没有"游戏"这个视觉语言，
 * 没兑现"像游戏主播打开自己的库"这句话。
 *
 * 这一版的结构：
 *
 *   ① 身份：一张脸 + 一句她自己的话，三秒钟知道在看谁
 *   ② 三个时代：视频 / 斗鱼 / 抖音，各自的第一条记录
 *   ③ 她的游戏库：像打开自己 Steam 库那样的几排封面
 *   ④ 有些晚上，到现在还记得：六张手选的卡，允许主观，但每张都锚定在真实数据上
 *   ⑤ 那面墙：「这之外，还有 N 个普通的晚上」
 *   ⑥ 三个数字 → 是谁存下来的 → 各栏目入口
 *
 * 想法上的转变：上一版怕"主观"，把选择权全部交给公式，结果选出来的东西正确但生疏。
 * 这一版承认**首页需要编辑判断**——但判断必须锚定在真实、可核实的数据点上，
 * 不能凭感觉瞎选。见 `src/lib/highlights.ts` 开头那段规矩。
 */
export default function HomePage() {
  const ds = getDataset()
  const entries = toTimelineEntries(ds)
  const facts = buildArchiveFacts(ds)

  const eraIntros = buildEraIntros(ds)
  const gameShelfRows = buildGameShelf(ds)
  const highlights = buildHighlights(ds)

  // 64 张：够让人觉得"翻不完"，但不会像上一版那样，一进门就先数有多少张图。
  const tiles = buildCoverWall(entries, 64)
  const wallStep = Math.round(facts.coverCount / tiles.length)
  const archivists = buildArchivists(ds, 9)
  const galleryCount = getGalleryCollection().items.length

  const douyin = ds.accounts.get('douyin-official')
  const identityQuote = douyin && selfDescription(douyin)
  const latestAvatar = AVATARS[AVATARS.length - 1]

  return (
    <main className="ui-page-in min-h-screen">
      <header className="ui-slide-down mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <SiteNav active="home" />
        <Link href="/chronicle/" className="ui-press hidden rounded-sm font-mono text-[11px] text-live underline-offset-4 hover:underline sm:block">
          打开全部 {facts.entryCount.toLocaleString()} 条记录 →
        </Link>
      </header>

      {/* ① 身份。不做传统 Hero，但三秒钟要知道在看谁——一张脸、一句她自己的话。 */}
      <section className="mx-auto max-w-[1400px] px-4 pt-6 sm:px-6 sm:pt-10">
        <div className="flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={latestAvatar.src}
            alt={latestAvatar.alt}
            className="h-14 w-14 shrink-0 rounded-full border border-line object-cover sm:h-16 sm:w-16"
          />
          <div>
            <p className="text-[17px] font-medium text-ink sm:text-[19px]">石悦 · 女流66</p>
            <p className="mt-0.5 font-mono text-[11px] text-faint">
              {facts.yearSpan.from}—{facts.yearSpan.to}
              {identityQuote && <span className="ml-2 text-muted">「{identityQuote}」</span>}
            </p>
          </div>
        </div>

        {/* 她换过的三张脸：都是斗鱼期的头像，按年份并排，不轮播。 */}
        <div className="mt-6 flex flex-wrap items-end gap-5 border-t border-line pt-6 sm:gap-8">
          {AVATARS.map((avatar) => (
            <figure key={avatar.src} className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatar.src} alt={avatar.alt} className="h-8 w-8 rounded-full border border-line object-cover" />
              <figcaption className="font-mono text-[10px] text-faint tnum">{avatar.when}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ② 三个时代。 */}
      <section className="mx-auto mt-16 max-w-[1400px] px-4 sm:mt-20 sm:px-6">
        <EraRow intros={eraIntros} />
      </section>

      {/* ③ 她的游戏库。这是上一版首页完全没有的东西：游戏，不是直播截图。 */}
      <section className="mx-auto mt-20 max-w-[1400px] px-4 sm:mt-28 sm:px-6">
        <h2 className="text-[13px] text-muted">她的游戏库。</h2>
        <div className="mt-6">
          <GameShelf rows={gameShelfRows} />
        </div>
        <Link href="/games/" className="ui-press mt-6 inline-block rounded-sm font-mono text-[11px] text-live underline-offset-4 hover:underline">
          全部 {facts.gamesPlayed} 个游戏 →
        </Link>
      </section>

      {/* ④ 有些晚上，到现在还记得。允许主观判断的地方，见 highlights.ts 开头那段规矩。 */}
      <section className="mx-auto mt-24 max-w-[1400px] px-4 sm:mt-32 sm:px-6">
        <h2 className="text-[13px] text-muted">有些晚上，到现在还记得。</h2>
        <div className="ui-reveal mt-8">
          <MemoryShelf items={highlights} />
        </div>
      </section>

      {/* ⑤ 那面墙。前面挑出来的是记得最清楚的，这一片是没人特意挑但一条没丢的。 */}
      <section className="mx-auto mt-24 max-w-[1400px] px-4 sm:mt-32 sm:px-6">
        <p className="max-w-2xl text-[17px] font-medium leading-[1.8] text-ink sm:text-[20px]">
          这之外，还有 <span className="tnum">{facts.activeDays.toLocaleString()}</span> 个普通的晚上。
          <span className="text-muted"> 一张封面都没丢。</span>
        </p>
        <div className="ui-reveal mt-8">
          <CoverWall tiles={tiles} />
        </div>
        <p className="mt-4 max-w-3xl text-[12px] leading-7 text-faint">
          这面墙是从 {facts.coverCount.toLocaleString()} 张里每隔 {wallStep} 条抽一张排出来的，按时间从上往下——
          2010 年稀，2017 年密，那是它本来的样子。老封面糊，是因为 2010 年的优酷就那么大；
          这里不会把它放大成假的清晰。
          <Link href="/chronicle/" className="ui-press ml-2 text-live underline-offset-4 hover:underline">
            打开全部 {facts.entryCount.toLocaleString()} 条 →
          </Link>
        </p>
      </section>

      {/* ⑥ 三个数字。不放"公开条目 2,662"——那是数据库的说法。 */}
      <section className="mx-auto mt-24 max-w-[1400px] px-4 sm:mt-32 sm:px-6">
        <dl className="grid gap-8 border-y border-line py-10 sm:grid-cols-3">
          <Figure value={facts.activeDays.toLocaleString()} unit="天" label="有记录的直播 / 更新日" />
          <Figure
            value={facts.knownHours.toLocaleString()}
            unit="小时"
            label={
              // 时长覆盖率已经接近满格时不必每次都念一遍口径，那属于审计报告，不该贴在首页。
              facts.knownDurationEntries < facts.entryCount * 0.95
                ? `已知时长，合 ${facts.knownDays} 天不吃不睡（只算 ${facts.knownDurationEntries.toLocaleString()} 场填了时长的）`
                : `已知时长，合 ${facts.knownDays} 天不吃不睡`
            }
          />
          <Figure
            value={facts.gamesPlayed.toLocaleString()}
            unit="个游戏"
            label={`其中 ${facts.playedOnce} 个只播过一次`}
          />
        </dl>
      </section>

      {/* ⑦ 落点：是谁把这些留下来的。这一段旧版整个站上一个字都没有。 */}
      <section className="mx-auto mt-24 max-w-[1400px] px-4 sm:mt-32 sm:px-6">
        <p className="max-w-3xl text-[19px] font-medium leading-[1.9] text-ink sm:text-[26px] sm:leading-[1.8]">
          全站 {facts.sourceTotal.toLocaleString()} 条能打开的链接里，
          <span className="text-video">{facts.originalSources} 条</span>是她自己发的，
          <span className="text-live">{facts.replaySources.toLocaleString()} 条</span>是别人录下来的。
        </p>
        <p className="mt-5 max-w-2xl text-[13px] leading-7 text-muted">
          账号档案里记了 {facts.fanArchiveAccounts} 个水友的录播 / 补档号（另有 {facts.officialAccounts} 个官方号）。
          下面是他们各自在简介里写的话，原文照抄。
        </p>

        <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {archivists.map((a) => (
            <li key={a.id} className="border-t border-line pt-4">
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer noopener"
                className="ui-press inline-block rounded-sm text-[14px] text-ink underline-offset-4 hover:text-live hover:underline"
              >
                {a.name}
              </a>
              <span className="ml-2 font-mono text-[10px] text-faint">
                {PLATFORM_META[a.platform as Platform]?.name ?? a.platform}
              </span>
              {a.quote && <p className="mt-2 text-[13px] leading-7 text-muted">「{a.quote}」</p>}
            </li>
          ))}
        </ul>

        <p className="mt-10 max-w-2xl font-mono text-[11px] leading-6 text-faint">
          注：这份名单是账号档案本身。每一条来源具体出自哪个号，数据里还没有对应关系
          （<code className="text-muted">Source.account</code> 填充率目前为 0），所以这里不能、也没有逐条署名。
        </p>
      </section>

      {/* ⑧ 入口。刻意不做成四张一样的卡片。 */}
      <nav className="mx-auto mt-24 max-w-[1400px] px-4 sm:mt-32 sm:px-6">
        <ul className="border-t border-line">
          <Door href="/chronicle/" name="编年史" figure={`${facts.entryCount.toLocaleString()} 条`} desc="按年月往下翻，也能搜、能筛、能跳年。" color="#5BC8E8" />
          <Door href="/games/" name="游戏库" figure={`${facts.gamesPlayed} 个游戏`} desc="每个游戏的封面，是她玩它那天的截图。" color="#E0A244" />
          <Door href="/series/" name="系列与栏目" figure={`${facts.seriesWithEntries} 档`} desc="心灵砒霜七年，每个星期天。" color="#FF6B75" />
          <Door
            href="/stats/"
            name="统计"
            figure={`${facts.segmentCount.toLocaleString()} 条分段`}
            desc={`分布在 ${facts.segmentEntryCount.toLocaleString()} 场里，带时间码，点一下跳到那一秒。`}
            color="#A78BFA"
          />
          <Door href="/gallery/" name="画廊" figure={`${galleryCount} 张`} desc="水友画的周年画，附创作背景。" color="#E5568A" />
        </ul>
      </nav>

      <footer className="mx-auto mt-24 flex max-w-[1400px] flex-col justify-between gap-4 px-4 py-10 font-mono text-[10px] text-faint sm:flex-row sm:px-6">
        <span>只索引，不搬运 · 所有播放回到原平台</span>
        <Link href="/contact/" className="ui-press rounded-sm transition-colors hover:text-live">资料纠错与联系 →</Link>
      </footer>
    </main>
  )
}

function Figure({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div>
      <dt className="flex items-baseline gap-2">
        <span className="font-display text-[44px] font-bold leading-none text-ink tnum sm:text-[60px]">{value}</span>
        <span className="text-[14px] text-muted">{unit}</span>
      </dt>
      <dd className="mt-3 text-[12px] leading-6 text-faint">{label}</dd>
    </div>
  )
}

function Door({
  href,
  name,
  figure,
  desc,
  color,
}: {
  href: string
  name: string
  figure: string
  desc: string
  color: string
}) {
  return (
    <li className="border-b border-line">
      <Link href={href} className="ui-press group flex flex-wrap items-baseline gap-x-5 gap-y-1 py-5">
        <span className="h-2 w-2 shrink-0 self-center rounded-full" style={{ background: color }} />
        <span className="text-[19px] font-medium text-ink group-hover:text-live sm:text-[22px]">{name}</span>
        <span className="font-mono text-[11px] text-muted tnum">{figure}</span>
        <span className="w-full text-[12px] leading-6 text-faint sm:w-auto sm:flex-1">{desc}</span>
        <span className="hidden text-faint transition-transform group-hover:translate-x-1 sm:inline">→</span>
      </Link>
    </li>
  )
}
