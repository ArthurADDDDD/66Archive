import Link from 'next/link'

const ITEMS = [
  { href: '/', label: '首页', id: 'home' },
  { href: '/chronicle/', label: '编年史', id: 'chronicle' },
  { href: '/gallery/', label: '画廊', id: 'gallery' },
  { href: '/contact/', label: '联系我们', id: 'contact' },
] as const

export function SiteNav({ active, compact = false }: { active: 'home' | 'chronicle' | 'gallery' | 'contact' | 'entry'; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3 sm:gap-5">
      {!compact && (
        <Link href="/" className="ui-press mr-1 shrink-0 rounded-sm font-mono text-[13px] font-semibold tracking-tight text-ink transition-colors hover:text-live">
          女流66编年史
        </Link>
      )}
      <nav aria-label="主导航" className="flex items-center gap-1 rounded-full border border-line/80 bg-surface/70 p-1 shadow-[0_8px_30px_rgba(0,0,0,0.1)] transition-[border-color,box-shadow] duration-300 hover:border-muted/70 hover:shadow-[0_10px_35px_rgba(0,0,0,0.18)]">
        {ITEMS.map((item) => {
          const selected = active === item.id || (active === 'entry' && item.id === 'chronicle')
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={selected ? 'page' : undefined}
              className={`ui-press rounded-full px-2.5 py-1.5 font-mono text-[10px] sm:px-3 sm:text-[11px] ${selected ? 'bg-ink text-base shadow-[0_4px_14px_rgba(230,228,239,0.12)]' : 'text-muted hover:bg-raised hover:text-ink'
                }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
