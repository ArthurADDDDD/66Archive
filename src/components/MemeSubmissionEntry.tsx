'use client'

import { SubmissionForm } from './SubmissionForm'

/**
 * 「直播间梗」区域的投稿入口按钮，和分类 tab 放在一起，带「补充+」文字。
 * 展开状态由父组件（HighlightStrip）持有——按钮在 tab 行，但表单要展开在
 * 分类说明下面那一整行，两处不在同一个容器里，所以状态提到共同的父级。
 */
export function MemeSubmissionButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="meme-submission-panel"
      aria-label={open ? '收起投稿' : '投稿一个梗'}
      title={open ? '收起投稿' : '投稿一个梗'}
      className="ui-press flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 py-2 text-meta text-faint transition-colors hover:border-live/45 hover:text-ink"
    >
      <span>补充</span>
      <span aria-hidden className={`font-mono transition-transform ${open ? 'rotate-45' : ''}`}>+</span>
    </button>
  )
}

export function MemeSubmissionPanel() {
  return (
    <div id="meme-submission-panel" className="ui-panel-in mt-5 rounded-xl border border-line bg-base/40 p-4">
      <SubmissionForm
        kind="meme"
        nameLabel="怎么称呼你"
        namePlaceholder="留个 ID 就行"
        bodyLabel="说说这个梗"
        bodyPlaceholder="简单说明一下这个梗/名场面是什么。如果知道是哪场直播、几分几秒，写出来最好——越精确越容易核实，比如「2024-05-01 直播，1:23:45 左右」。"
        successMessage="收到，谢谢。我会看看能不能收进直播间梗里。"
        disabledMessage="投稿功能暂未开放。"
        submitLabel="提交"
        againLabel="再投一个"
      />
    </div>
  )
}
