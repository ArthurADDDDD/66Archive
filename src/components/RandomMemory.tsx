'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Eyebrow } from './primitives'

export type MemoryCandidate = { id: string; date: string; title: string }

/**
 * 随便回到一个晚上：从「有内容的条目」池里随机抽一个。
 * 池由服务端筛选（有封面 / 有游戏 / 有栏目），客户端只做随机与跳转。
 */
export function RandomMemory({ pool }: { pool: MemoryCandidate[] }) {
  const [pick, setPick] = useState<MemoryCandidate | null>(null)

  return (
    <div className="flex h-full flex-col rounded-2xl border border-dashed border-line bg-surface/25 p-6 sm:p-8">
      <Eyebrow>Random · 随机记忆</Eyebrow>
      {/* 卡片内标题降到 h3——和「回到过去，只需要一晚。」这个节标题差一级 */}
      <h3 className="mt-3 text-h3 font-semibold text-ink">随便回到一个晚上。</h3>
      <p className="mt-3 max-w-md text-body text-muted">
        档案里有 {pool.length} 个「值得回去」的晚上——有画面、有游戏、有栏目。抽一个，回去看看那天发生了什么。
      </p>
      <button
        onClick={() => setPick(pool[Math.floor(Math.random() * pool.length)] ?? null)}
        className="ui-press group mt-5 w-fit rounded-full border border-line bg-surface/60 px-5 py-2.5 text-meta text-muted transition-colors hover:border-live/60 hover:text-ink"
      >
        回到一个晚上
        <span className="ml-2 inline-block font-mono transition-transform group-hover:translate-y-0.5">↯</span>
      </button>

      {pick && (
        <Link href={`/e/${pick.id}/`} className="ui-press group mt-auto pt-8">
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
