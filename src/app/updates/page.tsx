import Link from 'next/link'
import { SiteFooter } from '@/components/primitives'
import { UpdateTag } from '@/components/UpdateTag'
import { UpdateCopy } from '@/components/UpdateCopy'
import { SiteText } from '@/components/SiteText'
import { getUpdateHistory, type UpdateHistoryItem } from '@/lib/update-notice'
import { pageMetadata } from '@/lib/page-metadata'

export const metadata = pageMetadata({
  path: '/updates/',
  title: '更新记录',
  description: '女流档案馆的历次网站功能更新和精选补档记录，按时间查看。',
})

const history = getUpdateHistory()

function groupByMonth(items: UpdateHistoryItem[]) {
  const months = new Map<string, UpdateHistoryItem[]>()
  for (const item of items) {
    const month = item.date.slice(0, 7)
    const group = months.get(month) ?? []
    group.push(item)
    months.set(month, group)
  }
  return [...months.entries()]
}

const months = groupByMonth(history)

/** A plain static reading page, like /privacy/, without the in-page BGM player. */
export default function UpdatesPage() {
  return (
    <main className="min-h-screen">
      <article className="site-container max-w-4xl px-page py-14 sm:py-20">
        <Link href="/" prefetch={false} className="inline-flex min-h-11 items-center text-meta text-live hover:underline">
          <SiteText id="updates-back" />
        </Link>

        <header className="mt-8 sm:mt-10">
          <p className="text-meta font-medium tracking-widest text-live"><SiteText id="updates-eyebrow" /></p>
          <h1 className="mt-3 text-h1 font-semibold text-ink"><SiteText id="updates-title" /></h1>
          <p className="mt-5 max-w-2xl text-body leading-relaxed text-muted">
            <SiteText id="updates-lede" />
          </p>
          <p className="mt-3 text-meta text-faint">
            <SiteText id="updates-note" />
          </p>
        </header>

        <nav aria-label="按月份跳转更新记录" className="mt-8 flex flex-wrap gap-2 sm:mt-10">
          {months.map(([month, items]) => (
            <a
              key={month}
              href={`#updates-${month}`}
              className="ui-press inline-flex min-h-10 items-center gap-2 rounded-full border border-line/80 bg-surface/50 px-4 font-mono text-meta text-muted transition-colors hover:border-live/50 hover:text-live focus-visible:outline focus-visible:outline-2 focus-visible:outline-live"
            >
              {month.replace('-', '.')}
              <span className="text-faint">{items.length}</span>
            </a>
          ))}
        </nav>

        <div className="mt-12 border-t border-line/70 sm:mt-16">
          {months.map(([month, items]) => (
            <section key={month} aria-labelledby={`updates-${month}`} className="border-b border-line/60 py-7 sm:py-10">
              <div className="grid gap-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-8">
                <h2 id={`updates-${month}`} className="scroll-mt-24 font-mono text-h3 font-semibold text-live tnum">
                  {month.replace('-', '.')}
                </h2>
                <ol className="min-w-0 divide-y divide-line/50">
                  {items.map((item) => (
                    <li key={`${item.category}-${item.date}-${item.source ?? item.title}`} className="py-5 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <time dateTime={item.date} className="mr-1 font-mono text-meta text-faint tnum">
                          {item.date.replaceAll('-', '.')}
                        </time>
                        <UpdateTag label={item.category} />
                        {(item.tags ?? []).slice(0, 2).map((tag) => <UpdateTag key={tag} label={tag} />)}
                      </div>
                      <h3 className="mt-3 text-h3 font-semibold text-ink"><UpdateCopy category={item.category === '功能' ? 'feature' : 'archive'} entry={item} field="title" /></h3>
                      <p className="mt-2 max-w-2xl text-body leading-relaxed text-muted"><UpdateCopy category={item.category === '功能' ? 'feature' : 'archive'} entry={item} field="text" /></p>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          ))}
        </div>

        <p className="mt-8 text-meta text-faint">
          <SiteText id="updates-ending" />
        </p>
      </article>
      <SiteFooter />
    </main>
  )
}
