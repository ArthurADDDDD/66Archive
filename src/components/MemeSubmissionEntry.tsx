'use client'

import { useState } from 'react'
import { SubmissionForm } from './SubmissionForm'

/**
 * 「直播间梗」区域的投稿入口。折叠成一个按钮，点开才展开表单——
 * 这一块首页本来就摆着四个分类 tab 和好几行梗，默认展开一个完整表单
 * 会把本来就热闹的区域挤得更满，而投稿是低频操作，不值得占这个位置。
 */
export function MemeSubmissionEntry() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="ui-press min-h-9 shrink-0 rounded-full border border-line px-3 text-meta text-muted hover:border-live/45 hover:text-ink sm:px-4"
      >
        {open ? '收起投稿' : '投稿一个梗 +'}
      </button>

      {open && (
        <div className="ui-panel-in mt-4 rounded-xl border border-line bg-base/40 p-4">
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
