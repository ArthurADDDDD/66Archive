'use client'

import type { ResolvedAct } from '@/lib/narrative'
import { applyLiveActs } from '@/lib/live-content'
import { ActSection } from './ActSection'
import { useLiveContent } from './LiveContentProvider'

/**
 * 首页移动端三幕（含后台新增的 custom-* 幕）。
 * 桌面端由 HomeActStage 负责；这里保持自然文档流，避免触屏滚动被锁定。
 */
export function HomeActSections({
  acts,
  now,
}: {
  acts: ResolvedAct[]
  now?: { year: string; label: string; count: number }
}) {
  const { narrative } = useLiveContent()
  const resolvedActs = applyLiveActs(acts, narrative?.homeActs, true, narrative?.deletedIds ?? [])

  return (
    <div className="relative xl:hidden">
      {resolvedActs.map((act, index) => (
        <ActSection
          key={act.act.id}
          act={act}
          showCount={false}
          sectionId={`mobile-${act.act.id}`}
          beatAnchorPrefix={`mobile-${act.act.id}-`}
          now={index === resolvedActs.length - 1 ? now : undefined}
          liveApplied
        />
      ))}
    </div>
  )
}
