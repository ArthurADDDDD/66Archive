'use client'

import { useState } from 'react'
import { SubmissionForm } from './SubmissionForm'

/**
 * 「直播间梗」区域的投稿入口：一个圆形 + 图标，点开才展开表单。
 *
 * 视觉上复用这一屏里已有的展开/收起图标语言（见 Row 组件里同款的圆形按钮），
 * 而不是另造一个「投稿」按钮——同一屏里两种「点开一个东西」的控件长得不一样，
 * 会让人误以为是两种不同的操作。
 */
export function MemeSubmissionEntry() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="meme-submission-panel"
        aria-label={open ? '收起投稿' : '投稿一个梗'}
        title={open ? '收起投稿' : '投稿一个梗'}
        className="ui-press flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line font-mono text-base text-faint transition-[transform,color,border-color] hover:border-live/45 hover:text-ink"
      >
        <span aria-hidden className={`transition-transform ${open ? 'rotate-45' : ''}`}>+</span>
      </button>

      {open && (
        <div id="meme-submission-panel" className="ui-panel-in mt-4 rounded-xl border border-line bg-base/40 p-4">
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
      )}
    </div>
  )
}
