'use client'

import { useState } from 'react'
import { SubmissionForm } from './SubmissionForm'

/**
 * 联系页的「提交线索」入口：默认折叠，点开才挂载表单。
 *
 * **折叠不只是排版。** SubmissionForm 一挂载就会拉一次配置接口、
 * 再把 Cloudflare Turnstile 组件渲染出来——也就是说只要有人打开联系页，
 * 哪怕根本没打算提交，也会白白触发一次人机验证。表单放在条件渲染里，
 * 这些副作用就只在真的要写的时候才发生。
 */
export function CorrectionSubmission() {
  const [open, setOpen] = useState(false)

  return (
    <article className="ui-card rounded-2xl border border-line bg-surface/55 p-6 sm:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <span className="text-meta uppercase tracking-[0.16em] text-live">提交线索</span>
          <h2 className="mt-3 text-h3 font-medium">直接在这里告诉我</h2>
          <p className="measure-body mt-2 text-body text-muted">
            不用注册，也不用去 GitHub 开 issue。写清楚是哪条记录、哪里不对就行。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="correction-submission-panel"
          className="ui-press flex shrink-0 items-center gap-1.5 rounded-full border border-line px-4 py-2 text-control text-muted transition-colors hover:border-live/45 hover:text-ink"
        >
          {open ? '收起' : '写一条'}
          <span aria-hidden className={`font-mono transition-transform ${open ? 'rotate-45' : ''}`}>
            +
          </span>
        </button>
      </div>

      {open && (
        <div id="correction-submission-panel" className="ui-panel-in">
          <SubmissionForm
            kind="correction"
            className="mt-5"
            nameLabel="怎么称呼你"
            namePlaceholder="留个 ID 就行，方便我知道是谁发现的"
            bodyLabel="发现了什么问题"
            bodyPlaceholder="哪条记录、哪个字段不对、正确的应该是什么。有链接可以一起贴上来。"
            successMessage="收到，谢谢。我会逐条看过再决定怎么改。"
            disabledMessage="提交功能暂未开放。你仍然可以从下面的项目仓库找到我。"
            submitLabel="提交"
            againLabel="再提交一条"
          />
        </div>
      )}
    </article>
  )
}
