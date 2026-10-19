/**
 * Repeatable accent colors for visible update labels.
 * Keep Tailwind classes literal so production extraction includes each palette.
 */
const themeByTag: Record<string, string> = {
  游戏: 'border-amber-400/50 bg-amber-400/15 text-amber-200',
  找录像: 'border-amber-400/50 bg-amber-400/15 text-amber-200',
  筛选: 'border-amber-400/50 bg-amber-400/15 text-amber-200',
  提醒: 'border-rose-400/50 bg-rose-400/15 text-rose-200',
  通知: 'border-rose-400/50 bg-rose-400/15 text-rose-200',
  开播提醒: 'border-rose-400/50 bg-rose-400/15 text-rose-200',
  邮件: 'border-rose-400/50 bg-rose-400/15 text-rose-200',
  手机: 'border-sky-400/50 bg-sky-400/15 text-sky-200',
  搜索: 'border-sky-400/50 bg-sky-400/15 text-sky-200',
  画廊: 'border-fuchsia-400/50 bg-fuchsia-400/15 text-fuchsia-200',
  纪念特辑: 'border-fuchsia-400/50 bg-fuchsia-400/15 text-fuchsia-200',
  画质: 'border-fuchsia-400/50 bg-fuchsia-400/15 text-fuchsia-200',
  大事件: 'border-violet-400/50 bg-violet-400/15 text-violet-200',
  网站: 'border-teal-400/50 bg-teal-400/15 text-teal-200',
  新名字: 'border-teal-400/50 bg-teal-400/15 text-teal-200',
  功能: 'border-cyan-400/50 bg-cyan-400/15 text-cyan-200',
  收录: 'border-emerald-400/50 bg-emerald-400/15 text-emerald-200',
}

export function UpdateTag({ label }: { label: string }) {
  const colors = themeByTag[label] ?? 'border-slate-400/45 bg-slate-400/15 text-slate-200'
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold leading-5 ${colors}`}>
      {label}
    </span>
  )
}
