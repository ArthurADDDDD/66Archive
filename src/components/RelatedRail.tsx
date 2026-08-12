import type { RelationRail as Rail } from '@/lib/relations'
import { EntityPill } from './EntityPill'

/** 关系网络：一组可点击的出口，让详情页通向编年史 / 栏目 / 画廊。 */
export function RelatedRail({ rails }: { rails: Rail[] }) {
  const present = rails.filter((r) => r.items.length > 0)
  if (present.length === 0) return null

  return (
    <section className="border-t border-line py-14 sm:py-20">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">Related · 相关的路</p>
        <h2 className="mt-2 text-[20px] font-semibold tracking-tight text-ink sm:text-[26px]">顺着这条路，还能走到</h2>
        <div className="mt-6 space-y-6">
          {present.map((rail) => (
            <div key={rail.title}>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint/80">{rail.title}</p>
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
