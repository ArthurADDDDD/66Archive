import Link from 'next/link'
import { genreLabel } from '@/lib/genres'

/**
 * 一排游戏类型标签，每个都链回游戏厅并按这个类型筛选（`/games/?genre=<id>`）。
 * 游戏厅、游戏页、录播室详情共用这一份写法。
 */
export function GenreChips({ genres, className = '' }: { genres: string[]; className?: string }) {
  if (genres.length === 0) return null
  return (
    <ul aria-label="游戏类型" className={`flex flex-wrap gap-1.5 ${className}`}>
      {genres.map((id) => (
        <li key={id}>
          <Link
            href={`/games/?genre=${encodeURIComponent(id)}`}
            prefetch={false}
            data-analytics-event="filter.use"
            data-analytics-target="genre"
            className="ui-press inline-flex rounded-full border border-line px-2.5 py-1 text-meta text-muted transition-colors hover:border-live/50 hover:text-live"
          >
            {genreLabel(id)}
          </Link>
        </li>
      ))}
    </ul>
  )
}
