'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { WallTile } from '@/lib/archive'
import { ERAS, type EraId } from '@/lib/covers'
import { proxyImage } from '@/lib/platforms'

/** 时期决定占几格：视频期 1×1、斗鱼期 2×2、抖音期 3×3。 */
const SPAN: Record<EraId, number> = { video: 1, douyu: 2, douyin: 3 }

/**
 * 十六年的印样表（contact sheet）。
 *
 * 四条刻意的设计决定，改之前请先读 docs/redesign/02-implementation.md：
 *
 * 1. **格子大小按时期分三档，不是等大网格。** 2010 年一支 13 分钟的优酷视频和 2025 年
 *    一场 15 小时的直播不该在版面上一样大；而且老封面原图只有 200 像素宽，占小格子是
 *    它本来的样子，撑成大格子就是插值出来的假清晰。
 * 2. **严格按时间排，绝不用 grid-auto-flow:dense。** dense 会把小格子回填到前面的空洞里，
 *    版面是齐了，但墙就不再是一条时间线了。列数取 12 / 18 / 24（都能被 1、2、3 整除），
 *    再让每个时期从头一列另起一行——这样三段各自铺满，不靠打乱顺序来对齐。
 * 3. **图上不压任何文字。** 标题走下面那条说明栏——十六年的画面本身要先被看见，
 *    UI 不许盖在上面。
 * 4. **不做灯箱、不做轮播。** 点一张就是进那一条记录，回到原平台可播。
 *    这面墙是入口，不是相册控件。
 */
export function CoverWall({ tiles }: { tiles: WallTile[] }) {
  const [active, setActive] = useState<WallTile | null>(null)
  const shown = active ?? tiles[tiles.length - 1]
  const era = ERAS.find((e) => e.id === shown?.eraId)

  return (
    <div>
      <div
        className="grid grid-cols-12 gap-[2px] sm:grid-cols-18 lg:grid-cols-24"
        onMouseLeave={() => setActive(null)}
      >
        {tiles.map((tile, i) => {
          const span = SPAN[tile.eraId]
          // 换时期时另起一行，避免上一段的余数把下一段整体错开半格。
          const startsEra = i === 0 || tiles[i - 1].eraId !== tile.eraId
          return (
            <Link
              key={tile.id}
              href={`/e/${tile.id}/`}
              aria-label={`${tile.date} ${tile.title}`}
              onMouseEnter={() => setActive(tile)}
              onFocus={() => setActive(tile)}
              className="group relative block aspect-video overflow-hidden bg-raised transition-[filter] duration-200 hover:z-10 hover:brightness-125"
              style={{ gridColumn: startsEra ? `1 / span ${span}` : `span ${span}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proxyImage(tile.cover, span * 160) ?? ''}
                alt=""
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </Link>
          )
        })}
      </div>

      {/* 说明栏：鼠标滑过哪一张，这里就显示那一天她自己写的标题。 */}
      <div className="mt-3 flex min-h-[44px] flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-line pt-3">
        {shown && (
          <>
            <span className="font-mono text-[11px] tnum" style={{ color: era?.color }}>
              {shown.date}
            </span>
            <span className="font-mono text-[10px] text-faint">{era?.name}</span>
            <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink sm:text-[15px]">{shown.title}</span>
          </>
        )}
      </div>
    </div>
  )
}
