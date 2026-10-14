import type { ReactNode, RefObject } from 'react'

export function UpdateLogFrame({ id, title, note, children, scrollRef, onScroll }: {
  id: string
  title: string
  note: string
  children: ReactNode
  scrollRef?: RefObject<HTMLDivElement | null>
  onScroll?: () => void
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`${id}-title`} className="text-body font-medium text-muted">{title}</h2>
        <span id={`${id}-hint`} className="text-meta text-faint">由新到旧 · 框内滚动</span>
      </div>
      <div
        ref={scrollRef}
        role="region"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-hint ${id}-dates`}
        tabIndex={0}
        onScroll={onScroll}
        className="focus-ring-inset h-64 overflow-y-auto overscroll-contain rounded-lg border border-line/70 bg-surface/30 px-4 sm:px-5 [scrollbar-gutter:stable] [scrollbar-width:thin]"
      >
        {children}
      </div>
      <p id={`${id}-dates`} className="mt-2 text-meta text-faint">{note}</p>
    </section>
  )
}
