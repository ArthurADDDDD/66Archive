'use client'

import { SubmissionForm } from './SubmissionForm'

/**
 * 「直播间梗」的投稿入口按钮。
 *
 * 曾经它叫「补充 +」、摆在分类 tab 行里，形状和「日常梗」「游戏梗」一模一样，
 * 于是被当成第五个分类。现在它和邀请语一起摆在梗墙末尾（见 HighlightStrip），
 * 文案也改成一个动作而不是一个名词。
 *
 * 展开状态仍由父组件持有：按钮和表单在同一张卡里，但父组件还要据此决定别的排版。
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
      className="ui-press flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-live/45 bg-live/8 px-4 py-2.5 text-control text-live transition-colors hover:bg-live/14"
    >
      <span>{open ? '收起' : '说一个'}</span>
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
