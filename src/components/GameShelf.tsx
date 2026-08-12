import Link from 'next/link'
import type { GameShelfRow } from '@/lib/game-shelf'
import { proxyImage } from '@/lib/platforms'

/**
 * 首页的"游戏库"——打开自己 Steam 库时会看到的那种东西：几排，每排一个角度，
 * 封面挨着封面。这是这次返工要补的最大一块：01-vision 说的"游戏主播打开自己的库"，
 * 上一版首页只有直播截图，完全没有"游戏"这个视觉语言。
 *
 * 每排选哪些游戏的规则在 `src/lib/game-shelf.ts` 里，这里只管排版。
 * 同一个游戏不会出现在两排——规则已经在数据层去重了。
 */
export function GameShelf({ rows }: { rows: GameShelfRow[] }) {
  return (
    <div className="space-y-10">
      {rows.map((row) => (
        <div key={row.key}>
          <div className="flex items-baseline gap-3">
            <h3 className="text-[15px] font-medium text-ink">{row.label}</h3>
            <span className="font-mono text-[10px] text-faint">{row.hint}</span>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {row.games.map((g) => (
              <li key={g.id}>
                <Link href={`/games/${g.id}/`} className="ui-press group block">
                  <div className="aspect-video w-full overflow-hidden bg-raised">
                    {g.face && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={proxyImage(g.face, 400) ?? ''}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    )}
                  </div>
                  <p className="mt-2 truncate text-[13px] text-ink group-hover:text-live">{g.name}</p>
                  <p className="font-mono text-[10px] text-faint tnum">{g.badge}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
