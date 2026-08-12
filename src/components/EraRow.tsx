import Link from 'next/link'
import type { EraIntro } from '@/lib/eras-intro'
import { proxyImage } from '@/lib/platforms'

/**
 * 三个时代的入口。
 *
 * 不是三张一样的卡片——年份数字用各自的时期色，图按真实像素显示（同一条纪律，
 * 见 MemoryShelf 的 Stage）。每张卡代表的是**这个平台自己的第一条记录**，
 * 不是选出来的"高光时刻"：这一排要建立的是"三个家"的框架感，
 * 主观判断留给下面"有些晚上，到现在还记得"那一段。
 */
export function EraRow({ intros }: { intros: EraIntro[] }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-sm bg-line sm:grid-cols-3">
      {intros.map(({ era, count, toYear, opener }) => (
        <Link key={era.id} href={`/e/${opener.id}/`} className="ui-press group bg-base p-5 sm:p-6">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[13px] tnum" style={{ color: era.color }}>
              {era.fromYear}
              {toYear ? `–${toYear}` : '–至今'}
            </span>
            <span className="font-mono text-[10px] text-faint tnum">{count.toLocaleString()} 条</span>
          </div>
          <p className="mt-1 text-[15px] font-medium text-ink">{era.name}</p>

          <div className="mt-4 aspect-video w-full overflow-hidden bg-raised">
            {opener.cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proxyImage(opener.cover, 480) ?? ''}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
            )}
          </div>
          <p className="mt-3 font-mono text-[10px] text-faint tnum">{opener.date} · 第一条</p>
          <p className="mt-1 text-[13px] leading-snug text-ink group-hover:text-live">{opener.title}</p>
        </Link>
      ))}
    </div>
  )
}
