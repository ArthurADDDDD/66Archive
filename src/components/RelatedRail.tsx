import type { RelationRail as Rail } from '@/lib/relations'
import { EntityPill } from './EntityPill'
import { Eyebrow } from './primitives'

/** 关系网络：一组可点击的出口，让详情页通向编年史 / 栏目 / 画廊。 */
export function RelatedRail({ rails }: { rails: Rail[] }) {
  const present = rails.filter((r) => r.items.length > 0)
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
