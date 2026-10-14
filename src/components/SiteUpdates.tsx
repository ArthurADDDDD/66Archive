import { CollectionLog } from './CollectionLog'
import { UpdateLogFrame } from './UpdateLogFrame'
import { ARCHIVE_UPDATES, SITE_UPDATES } from '@/lib/site-updates'

/** 左栏保留功能摘要，右栏自动读取新增内容的收录时间。 */
export function SiteUpdates() {
  return (
    <section aria-label="网站与收录日志" className="site-container-wide px-page pb-10 pt-2">
      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        <UpdateLog
          id="site-updates"
          title="网站更新日志"
          updates={SITE_UPDATES}
          note="主要功能与体验变化；日期按功能完成记录整理，实际开放时间可能稍晚。"
        />
        <CollectionLog history={ARCHIVE_UPDATES} />
      </div>
    </section>
  )
}

function UpdateLog({ id, title, updates, note }: {
  id: string
  title: string
  updates: readonly { date: string; title: string; text: string }[]
  note: string
}) {
  return (
    <UpdateLogFrame id={id} title={title} note={note}>
      <ol className="divide-y divide-line/50">
        {updates.map((update) => (
          <li key={`${update.date}-${update.title}`} className="py-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <time dateTime={update.date} className="font-mono text-meta text-faint tnum">{update.date.replaceAll('-', '.')}</time>
              <h3 className="text-body font-medium text-muted">{update.title}</h3>
            </div>
            <p className="mt-1 text-body text-muted">{update.text}</p>
          </li>
        ))}
      </ol>
    </UpdateLogFrame>
  )
}
