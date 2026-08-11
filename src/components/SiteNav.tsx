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
        <Link href="/" className="mr-1 shrink-0 font-mono text-[13px] font-semibold tracking-tight text-ink">
          女流66编年史
        </Link>
      )}
      <nav aria-label="主导航" className="flex items-center gap-1 rounded-full border border-line/80 bg-surface/70 p-1">
        {ITEMS.map((item) => {
          const selected = active === item.id || (active === 'entry' && item.id === 'chronicle')
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={selected ? 'page' : undefined}
              className={`rounded-full px-2.5 py-1.5 font-mono text-[10px] transition-all sm:px-3 sm:text-[11px] ${selected ? 'bg-ink text-base shadow-sm' : 'text-muted hover:bg-raised hover:text-ink'
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
