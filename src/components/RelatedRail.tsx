import type { RelationRail as Rail } from '@/lib/relations'
import { EntityPill } from './EntityPill'
import { Eyebrow } from './primitives'

/** 关系网络：一组可点击的出口，让详情页通向编年史 / 栏目 / 画廊。 */
export function RelatedRail({ rails }: { rails: Rail[] }) {
  // 同一条 rail 里出现两个 href+label 都一样的出口，对读者是重复的按钮，
  // 对 React 是重复的 key。各处调用方各自去重容易漏，这里统一兜一层。
  const present = rails
    .map((rail) => ({
      ...rail,
      items: rail.items.filter(
        (item, index, list) =>
          list.findIndex((other) => other.href === item.href && other.label === item.label) === index,
      ),
    }))
    .filter((r) => r.items.length > 0)
  if (present.length === 0) return null

  return (
    <section className="border-t border-line py-12 sm:py-20">
      <div className="site-container px-page">
        <Eyebrow>Related · 相关的路</Eyebrow>
        <h2 className="mt-2 text-h3 font-semibold text-ink">顺着这条路，还能走到</h2>
        <div className="mt-6 space-y-6">
          {present.map((rail) => (
            <div key={rail.title}>
              <p className="text-meta uppercase tracking-[0.16em] text-faint">{rail.title}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {rail.items.map((item) => (
                  <EntityPill key={`${item.href}-${item.label}`} {...item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
