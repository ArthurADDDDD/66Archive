'use client'

import { SubmissionForm } from './SubmissionForm'
import { SiteText } from './SiteText'
import { useSiteText } from './LiveContentProvider'

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
      <span>{open ? '收起' : <SiteText id="home-meme-open" />}</span>
      <span aria-hidden className={`font-mono transition-transform ${open ? 'rotate-45' : ''}`}>+</span>
    </button>
  )
}

export function MemeSubmissionPanel() {
  const nameLabel = useSiteText('home-meme-name-label')
  const namePlaceholder = useSiteText('home-meme-name-placeholder')
  const bodyLabel = useSiteText('home-meme-body-label')
  const bodyPlaceholder = useSiteText('home-meme-body-placeholder')
  const successMessage = useSiteText('home-meme-success')
  const disabledMessage = useSiteText('home-meme-disabled')
  const submitLabel = useSiteText('home-meme-submit')
  const againLabel = useSiteText('home-meme-again')
  return (
    <div id="meme-submission-panel" className="ui-panel-in mt-5 rounded-xl border border-line bg-base/40 p-4">
      <SubmissionForm
        kind="meme"
        nameLabel={nameLabel}
        namePlaceholder={namePlaceholder}
        bodyLabel={bodyLabel}
        bodyPlaceholder={bodyPlaceholder}
        successMessage={successMessage}
        disabledMessage={disabledMessage}
        submitLabel={submitLabel}
        againLabel={againLabel}
      />
    </div>
  )
}
