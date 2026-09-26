'use client'

import type { StorySection } from '@/lib/story-years'
import { CHRONICLE_ERAS, inEra, type ChronicleEraId } from '@/lib/chronicle-eras'

function rangeLabel(sections: StorySection[], to: number | null): string {
  if (sections.length === 0) return ''
  const first = sections[0].year
  return to === null ? `${first}—现在` : `${first}—${sections[sections.length - 1].endYear}`
}

function beatCount(sections: StorySection[]): number {
  return sections.reduce((sum, section) => sum + (section.featured?.length ? section.featured.length : section.hero ? 1 : 0) + section.secondary.length, 0)
}

/**
 * 三个时代的切换。手机上三格平分一行（时代名 + 年份 + 节点数），不横向滚动。
 * 用真 tablist 语义：左右键在三段之间切换。
 */
export function ChronicleEraTabs({
  sections,
  era,
  onChange,
}: {
  sections: StorySection[]
  era: ChronicleEraId
  onChange: (era: ChronicleEraId) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="大事件分段"
      className="grid grid-cols-[1fr_1.3fr_1fr] gap-1.5 rounded-xl border border-line bg-surface/60 p-1.5 sm:grid-cols-3 sm:gap-2 sm:p-2"
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        const at = CHRONICLE_ERAS.findIndex((item) => item.id === era)
        const next = CHRONICLE_ERAS[(at + (event.key === 'ArrowLeft' ? -1 : 1) + CHRONICLE_ERAS.length) % CHRONICLE_ERAS.length]
        onChange(next.id)
        requestAnimationFrame(() => document.getElementById(`chronicle-era-tab-${next.id}`)?.focus())
      }}
    >
      {CHRONICLE_ERAS.map((item) => {
        const own = inEra(sections, item.id)
        const selected = item.id === era
        return (
          <button
            key={item.id}
            id={`chronicle-era-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls="chronicle-era-panel"
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={`ui-press min-w-0 rounded-md border px-2 py-2 text-center transition-colors sm:px-4 sm:py-3 sm:text-left ${
              selected ? 'bg-raised text-ink' : 'border-transparent text-muted hover:bg-raised/50 hover:text-ink'
            }`}
            style={selected ? { borderColor: `${item.color}80`, boxShadow: `inset 0 -2px 0 ${item.color}` } : undefined}
          >
            <span className="flex items-center justify-center gap-2 text-[13px] font-semibold sm:justify-start sm:text-control">
              <span aria-hidden className="hidden h-2 w-2 shrink-0 rounded-full sm:block" style={{ background: item.color }} />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="mt-0.5 block truncate font-mono text-[0.6875rem] text-faint tnum sm:text-meta">
              {/* 手机上一格只有三分之一屏宽，年份写两位（06—14），不然会被截成「2006—20…」 */}
              <span className="sm:hidden">{rangeLabel(own, item.to).replace(/20(\d\d)/g, '$1')}</span>
              <span className="max-sm:hidden">{rangeLabel(own, item.to)}</span>
            </span>
            <span className="hidden text-meta text-faint tnum sm:block">{beatCount(own)} 个节点</span>
          </button>
        )
      })}
    </div>
  )
}

/** 一段读完：接到下一段（最后一段不显示）。 */
export function ChronicleEraNext({
  sections,
  era,
  onChange,
}: {
  sections: StorySection[]
  era: ChronicleEraId
  onChange: (era: ChronicleEraId) => void
}) {
  // 读完一段，底部同时给「上一段」和「下一段」：第一段只有下一段、最后一段只有上一段，
  // 只有一张时占满整行，两张时左右并排（左边往回、右边往后，和箭头方向一致）。
  const at = CHRONICLE_ERAS.findIndex((item) => item.id === era)
  const prev = CHRONICLE_ERAS[at - 1]
  const next = CHRONICLE_ERAS[at + 1]
  if (!prev && !next) return null
  const card = (target: (typeof CHRONICLE_ERAS)[number], direction: 'prev' | 'next') => {
    const own = inEra(sections, target.id)
    const arrow = <span aria-hidden className="text-h3 text-muted">{direction === 'prev' ? '←' : '→'}</span>
    return (
      <button
        key={direction}
        type="button"
        onClick={() => onChange(target.id)}
        className={`ui-press flex w-full items-center gap-4 rounded-xl border border-line bg-surface/60 px-5 py-4 hover:border-muted ${
          direction === 'prev' ? 'justify-start text-left' : 'justify-between text-left'
        }`}
      >
        {direction === 'prev' && arrow}
        <span className="min-w-0">
          <span className="block text-meta text-faint">{direction === 'prev' ? '上一段' : '下一段'}</span>
          <span className="mt-0.5 flex items-center gap-2 text-h3 font-semibold text-ink">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: target.color }} />
            {target.label}
          </span>
          <span className="mt-0.5 block font-mono text-meta text-faint tnum">{rangeLabel(own, target.to)}</span>
        </span>
        {direction === 'next' && arrow}
      </button>
    )
  }
  return (
    <nav aria-label="切换时代" className={`mt-10 grid gap-3 ${prev && next ? 'sm:grid-cols-2' : ''}`}>
      {prev && card(prev, 'prev')}
      {next && card(next, 'next')}
    </nav>
  )
}

/**
 * 电脑端页头里的紧凑分段（lg 起）：正文顶部那排大按钮滚出视口后才出现，
 * 页头本身是 sticky，所以读到哪儿都能一键换时代；滚回顶部它就收起，不和大按钮重复。
 * 位置在导航与「去录播室」之间——那一段在宽屏上本来是空的。
 */
export function ChronicleEraCompact({
  era,
  onChange,
  visible,
}: {
  era: ChronicleEraId
  onChange: (era: ChronicleEraId) => void
  visible: boolean
}) {
  return (
    <div
      role="group"
      aria-label="切换时代"
      aria-hidden={!visible}
      className={`ml-auto hidden shrink-0 items-center gap-0.5 rounded-full border border-line bg-surface/70 p-0.5 transition-opacity duration-200 lg:flex ${visible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      {CHRONICLE_ERAS.map((item) => {
        const selected = item.id === era
        return (
          <button
            key={item.id}
            type="button"
            tabIndex={visible ? 0 : -1}
            aria-pressed={selected}
            onClick={() => onChange(item.id)}
            className={`ui-press flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-meta transition-colors ${selected ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
