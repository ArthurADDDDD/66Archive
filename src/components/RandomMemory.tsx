'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Eyebrow } from './primitives'

export type MemoryCandidate = { id: string; date: string; title: string }

/**
 * 随便回到一个晚上：从「有内容的条目」池里随机抽一个。
 * 池由服务端筛选（有封面 / 有游戏 / 有栏目），客户端只做随机与跳转。
 *
 * `total` 与 `pool.length` 是两个不同的数，必须分开传。
 * 文案里那句「档案里有 N 个值得回去的晚上」说的是**全部**符合条件的条目，
 * 而 `pool` 只是其中等距抽样出来的一小撮候选。此前两者相同（池 = 400 条），
 * 于是 `pool.length` 恰好也是对的——但那 400 条要整份序列化进首页 RSC 载荷，
 * 实测占首页 flight 的 23.5%（27,042 / 114,871 字符），其中 380 条在 DOM 里
 * 一次都没出现过。把池收到 60 条以后 `pool.length` 就不再是那个数了，
 * 所以计数改由 `total` 单独给。
 */
export function RandomMemory({ pool, total }: { pool: MemoryCandidate[]; total: number }) {
  const [pick, setPick] = useState<MemoryCandidate | null>(null)

  return (
    <div className="flex flex-col rounded-2xl border border-dashed border-line bg-surface/25 p-6 sm:p-8 lg:min-h-[var(--memory-card-h)]">
      <Eyebrow>Random · 随机记忆</Eyebrow>
      {/* 卡片内标题降到 h3——和「回到过去，只需要一晚。」这个节标题差一级 */}
      <h3 className="mt-3 text-h3 font-semibold text-ink">随便回到一个晚上。</h3>
      <p className="measure-body mt-3 text-body text-muted">
        档案里有 {total.toLocaleString()} 个「值得回去」的晚上——有画面、有游戏、有栏目。抽一个，回去看看那天发生了什么。
      </p>
      <button
        data-analytics-event="random.refresh"
        onClick={() => setPick(pool[Math.floor(Math.random() * pool.length)] ?? null)}
        className="ui-press group mt-5 w-fit rounded-full border border-line bg-surface/60 px-5 py-2.5 text-meta text-muted transition-colors hover:border-live/60 hover:text-ink"
      >
        回到一个晚上
        <span className="ml-2 inline-block font-mono transition-transform group-hover:translate-y-0.5">↯</span>
      </button>

      {pick && (
        <Link
          href={`/e/${pick.id}/`}
          prefetch={false}
          data-analytics-event="content.open"
          data-analytics-target={`entry:${pick.id}`}
          className="ui-press group mt-auto pt-8"
        >
          <div className="rounded-xl border border-line/80 bg-surface/50 p-4 transition-colors hover:border-muted/70">
            <p className="font-mono text-meta text-faint tnum">{pick.date}</p>
            <p className="mt-1.5 text-body font-medium leading-snug text-ink transition-colors group-hover:text-white">
              {pick.title}
            </p>
            <p className="mt-2 text-meta text-live">打开这一晚 →</p>
          </div>
        </Link>
      )}
    </div>
  )
}
