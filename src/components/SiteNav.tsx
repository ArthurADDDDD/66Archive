import Link from 'next/link'

const ITEMS = [
  { href: '/', label: '首页', id: 'home' },
  { href: '/chronicle/', label: '编年史', id: 'chronicle' },
  { href: '/games/', label: '游戏库', id: 'games' },
  { href: '/stats/', label: '统计', id: 'stats' },
  { href: '/series/', label: '系列', id: 'series' },
  { href: '/gallery/', label: '画廊', id: 'gallery' },
  { href: '/contact/', label: '联系我们', id: 'contact' },
] as const

export function SiteNav({
  active,
  compact = false,
}: {
  active: 'home' | 'chronicle' | 'games' | 'stats' | 'series' | 'gallery' | 'contact' | 'entry'
  compact?: boolean
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 sm:gap-5">
      {!compact && (
        <Link href="/" className="ui-press mr-1 hidden shrink-0 rounded-sm font-mono text-[13px] font-semibold tracking-tight text-ink transition-colors hover:text-live sm:inline-block">
          女流66编年史
        </Link>
      )}
      <nav
        aria-label="主导航"
        className="flex min-w-0 max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-line/80 bg-surface/70 p-1 shadow-[0_8px_30px_rgba(0,0,0,0.1)] transition-[border-color,box-shadow] duration-300 [-ms-overflow-style:none] [scrollbar-width:none] hover:border-muted/70 hover:shadow-[0_10px_35px_rgba(0,0,0,0.18)] [&::-webkit-scrollbar]:hidden sm:gap-1"
      >
        {ITEMS.map((item) => {
          const selected = active === item.id || (active === 'entry' && item.id === 'chronicle')
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={selected ? 'page' : undefined}
              className={`ui-press shrink-0 whitespace-nowrap rounded-full px-2 py-1.5 font-mono text-[10px] sm:px-3 sm:text-[11px] ${selected ? 'bg-ink text-base shadow-[0_4px_14px_rgba(230,228,239,0.12)]' : 'text-muted hover:bg-raised hover:text-ink'
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
