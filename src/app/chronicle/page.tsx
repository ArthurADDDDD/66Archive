import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/page-metadata'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { resolveStoryActs } from '@/lib/narrative'
import { buildStorySections } from '@/lib/story-years'
import { ChronicleView } from '@/components/ChronicleView'
import { LiveNarrativeSeed } from '@/components/LiveNarrativeSeed'
import { fetchBakedPageCopy, fetchBakedStoryNarrative } from '@/lib/baked-content'
import { LiveCopySeed } from '@/components/LiveCopySeed'

/** 标题、简介、canonical 与社交卡片都由 `pageMetadata()` 一次给齐（见该文件注释）。 */
export const metadata: Metadata = pageMetadata({
  path: '/chronicle/',
  title: '编年史',
  description: '从 2010 年的第一支视频到今天，一年一年走下来的路。',
})

/**
 * 编年史：故事模式。年份脊柱时间线，条目仍来自 STORY_ACTS 的策展列表
 * （buildStoryYears 只做归位与计数）。完整逐条档案在 /archive/（录播室）。
 */
export default async function ChroniclePage() {
  const ds = getDataset()
  const allEntries = toTimelineEntries(ds)
  const visibleEntries =
    process.env.NODE_ENV === 'development' && !ds.isDemo
      ? allEntries.filter((entry) => entry.uncheckedCount === 0)
      : allEntries

  const storyActs = resolveStoryActs(ds, visibleEntries)
  const storySections = buildStorySections(storyActs, visibleEntries)
  const latestYear = Number(visibleEntries[0]?.date.slice(0, 4)) || new Date().getFullYear()

  // 编年史只渲染 storyActs；首页那份 homeActs / highlights 在这里是纯负重。
  const narrative = await fetchBakedStoryNarrative()
  // 页面固定文字（`chronicle-`）一起烤进来，后台改过的句子首屏就是新的。
  const bakedCopy = await fetchBakedPageCopy([], { texts: ['chronicle-'] })

  return (
    <LiveCopySeed copy={bakedCopy}>
      <LiveNarrativeSeed narrative={narrative}>
        <ChronicleView storySections={storySections} latestYear={latestYear} />
      </LiveNarrativeSeed>
    </LiveCopySeed>
  )
}
