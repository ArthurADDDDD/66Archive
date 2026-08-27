import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { SubmissionForm } from '@/components/SubmissionForm'
import { BackToTop, MobileQuickNav } from '@/components/ScrollAffordances'
import { Eyebrow } from '@/components/primitives'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { PLATFORM_META } from '@/lib/platforms'

/** 站点维护者。目前只有一个人，如实写一个人，不摆一排占位头像。 */
const MAINTAINERS = [{ id: '哈密瓜逮捕可达鸭', role: '建站 · 数据整理 · 校对' }]

/**
 * 录播/切片来源致谢。
 * 名单不是手写的：按条目里 source.account 的实际引用次数从数据派生，
 * 谁的录像撑起了这份档案，数字自己会说——手写名单迟早和数据对不上。
 */
function collectSources() {
  const ds = getDataset()
  const entries = toTimelineEntries(ds)
  const byName = new Map([...ds.accounts.values()].map((account) => [account.name, account]))
  const counts = new Map<string, number>()
  for (const entry of entries) {
    // 一条记录里同一个账号可能挂了多个来源（分 P / 备用链接），只算一次。
    const seen = new Set<string>()
    for (const source of entry.sources) {
      const account = source.accountName ? byName.get(source.accountName) : undefined
      if (!account || account.role === 'official' || seen.has(account.id)) continue
      seen.add(account.id)
      counts.set(account.id, (counts.get(account.id) ?? 0) + 1)
    }
  }
  const credited = [...counts.entries()]
    .map(([id, count]) => ({ account: ds.accounts.get(id)!, count }))
    .filter((row) => Boolean(row.account) && row.account.platform !== 'youtube')
    .sort((a, b) => b.count - a.count || a.account.name.localeCompare(b.account.name))
  return { credited }
}

export default function ContactPage() {
  const { credited } = collectSources()
  return (
    <main className="ui-page-in min-h-screen">
      <MobileQuickNav active="contact" />
      <BackToTop />
      <header className="site-header-container flex items-center px-page py-5">
        <SiteNav active="contact" />
      </header>

      <section className="site-container px-page pb-20 pt-16 sm:pt-24">
        <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-today/10 blur-[60px] sm:h-72 sm:w-72 sm:blur-[100px]" />
        <Eyebrow color="#E5568A">Contact &amp; correction</Eyebrow>
        <h1 className="measure-hero mt-4 text-h1 font-semibold">让这份索引更准确。</h1>
        <p className="measure-body mt-6 text-body text-muted">
          如果你发现日期、标题、链接或直播内容有误，可以提交线索。游戏标签校准直接放在编年史条目的展开区域里，无需注册账号。
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <article className="ui-card rounded-2xl border border-line bg-surface/55 p-6 hover:border-live/40">
            <span className="text-meta uppercase tracking-[0.16em] text-live">资料纠错</span>
            <h2 className="mt-3 text-h3 font-medium">需要提供什么</h2>
            <ul className="mt-4 space-y-2 text-body text-muted">
              <li>具体条目的页面地址</li>
              <li>认为有误或缺失的字段</li>
              <li>能够佐证修改的公开来源</li>
            </ul>
          </article>

          <article className="ui-card rounded-2xl border border-line bg-surface/55 p-6 hover:border-today/40">
            <span className="text-meta uppercase tracking-[0.16em] text-today">联系渠道</span>
            <h2 className="mt-3 text-h3 font-medium">目前可以从 GitHub 联系</h2>
            <p className="mt-4 text-body text-muted">
              发现错漏、想补档或者提供来源，都可以从下面的项目仓库找到我。
            </p>
          </article>

          <article className="ui-card rounded-2xl border border-line bg-surface/55 p-6 sm:col-span-2">
            <span className="text-meta uppercase tracking-[0.16em] text-live">提交线索</span>
            <h2 className="mt-3 text-h3 font-medium">直接在这里告诉我</h2>
            <p className="measure-body mt-2 text-body text-muted">
              不用注册，也不用去 GitHub 开 issue。写清楚是哪条记录、哪里不对就行。
            </p>
            <SubmissionForm
              kind="correction"
              className="mt-4"
              nameLabel="怎么称呼你"
              namePlaceholder="留个 ID 就行，方便我知道是谁发现的"
              bodyLabel="发现了什么问题"
              bodyPlaceholder="哪条记录、哪个字段不对、正确的应该是什么。有链接可以一起贴上来。"
              successMessage="收到，谢谢。我会逐条看过再决定怎么改。"
              disabledMessage="提交功能暂未开放。你仍然可以从下面的项目仓库找到我。"
              submitLabel="提交"
              againLabel="再提交一条"
            />
          </article>

          <Link
            href="/archive/"
            className="ui-card ui-press group rounded-2xl border border-live/30 bg-live/5 p-6 hover:border-live/60 sm:col-span-2"
          >
            <span className="text-meta uppercase tracking-[0.16em] text-live">一起校对</span>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-h3 font-medium">在对应条目里帮忙判断</h2>
                <p className="measure-body mt-2 text-body text-muted">打开对应录像，看过原片以后，再帮忙补标签或者纠错。</p>
              </div>
              <span className="text-meta text-live transition-transform group-hover:translate-x-1">打开录播室 ↗</span>
            </div>
          </Link>

          <a
            href="https://github.com/ArthurADDDDD/66archive"
            target="_blank"
            rel="noopener noreferrer"
            className="ui-card ui-press group rounded-2xl border border-line bg-surface/55 p-6 hover:border-live/40 sm:col-span-2"
          >
            <span className="text-meta uppercase tracking-[0.16em] text-live">项目仓库</span>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-h3 font-medium">GitHub · 66archive</h2>
                <p className="mt-2 text-body text-muted">查看项目源码、数据更新和版本记录。</p>
              </div>
              <span className="text-meta text-live transition-transform group-hover:translate-x-1">打开仓库 ↗</span>
            </div>
          </a>
        </div>

        <section aria-label="贡献者与来源致谢" className="mt-16 border-t border-line pt-10">
          <Eyebrow color="#E0A244">Credits · 谁把这些留了下来</Eyebrow>
          <h2 className="measure-hero mt-3 text-h2 font-semibold">这份档案不是一个人攒出来的。</h2>
          <p className="measure-body mt-4 text-body text-muted">
            感谢上传录播的大家以及切片man
          </p>

          <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-line bg-surface/55 p-6">
              <span className="text-meta uppercase tracking-[0.16em] text-faint">维护</span>
              <ul className="mt-4 space-y-4">
                {MAINTAINERS.map((person) => (
                  <li key={person.id}>
                    <p className="text-h3 font-medium text-ink">{person.id}</p>
                    <p className="mt-1 text-meta text-faint">{person.role}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-6 border-t border-line/70 pt-4 text-meta text-faint">
                想一起补档或校对，可以从上面的 GitHub 仓库找到我。
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-surface/55 p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-meta uppercase tracking-[0.16em] text-faint">录播 · 切片来源</span>
                <span className="text-meta text-faint tnum">
                  <span className="font-mono text-[1.125rem] font-bold text-video">{credited.length}</span> 位 UP 主的录像被本站索引
                </span>
              </div>
              <ul className="mt-5 divide-y divide-line/50">
                {credited.map(({ account, count }) => (
                  <li key={account.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
                    <a
                      href={account.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ui-press min-w-0 truncate text-control text-ink transition-colors hover:text-video"
                    >
                      {account.name}
                    </a>
                    <span className="shrink-0 text-meta text-faint">{PLATFORM_META[account.platform]?.name ?? account.platform}</span>
                    <span className="ml-auto shrink-0 text-meta text-faint tnum">
                      <span className="font-mono text-control font-semibold text-ink">{count.toLocaleString()}</span> 场
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-line/70 pt-4 text-meta text-faint">
                名单会随着补档继续增加。如果漏了谁，欢迎告诉我。
              </p>
            </div>
          </div>
        </section>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/chronicle/" className="ui-press rounded-full bg-ink px-5 py-2.5 text-control font-medium text-[#12141C] hover:bg-white hover:shadow-[0_12px_38px_rgba(91,200,232,0.18)]">
            前往编年史
          </Link>
          <Link href="/" className="ui-press rounded-full border border-line px-5 py-2.5 text-control text-muted hover:border-muted hover:text-ink">
            返回首页
          </Link>
        </div>
      </section>
    </main>
  )
}
