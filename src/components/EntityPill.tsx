import Link from 'next/link'

/** 关系网络里的最小单元：一颗带色点的小胶囊。 */
export function EntityPill({
  href,
  label,
  hint,
  color,
}: {
  href: string
  label: string
  hint?: string
  color?: string
}) {
  return (
    <Link
      href={href}
      className="ui-press group inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3.5 py-2.5 text-[12px] text-muted transition-colors hover:border-muted hover:text-ink sm:py-1.5"
    >
      {color && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />}
      {label}
      {hint && <span className="font-mono text-[10px] text-faint tnum">{hint}</span>}
      <span aria-hidden className="font-mono text-[10px] text-faint/60 transition-transform group-hover:translate-x-0.5">→</span>
    </Link>
  )
}
