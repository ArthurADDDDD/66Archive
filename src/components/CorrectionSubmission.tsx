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
 *
 * 整张卡都是触发区（和同一列「一起校对」「项目仓库」两张卡的手感一致），
 * 不是右上角那一个小按钮——那个点击目标太小了。
 * 展开后卡片本身不再是按钮：里面有输入框，整块可点会把点输入框也当成收起。
 */
export function CorrectionSubmission() {
  const [open, setOpen] = useState(false)

  const head = (
    <>
      <span className="text-meta uppercase tracking-[0.16em] text-live">提交线索</span>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-h3 font-medium">发现哪里不对，写在这里</h2>
          <p className="measure-body mt-2 text-body text-muted">
            说清三件事就够：<strong className="font-medium text-ink">是哪条记录</strong>（贴页面地址最快）、
            <strong className="font-medium text-ink">哪里不对</strong>、
            <strong className="font-medium text-ink">正确的应该是什么</strong>。
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-meta text-live">
          {open ? '收起' : '写一条'}
          <span aria-hidden className={`font-mono transition-transform ${open ? 'rotate-45' : ''}`}>
            +
          </span>
        </span>
      </div>
    </>
  )

  /**
   * 一个真实例子胜过一句"请描述清楚"。
   * 展开时才显示：折叠态那张卡是入口，塞满示例会盖过它旁边的另外两张卡。
   */
  const hint = (
    <div className="mt-5 rounded-xl border border-line/70 bg-base/25 p-[clamp(0.875rem,1.4vw,1.25rem)]">
      <p className="text-meta uppercase tracking-[0.16em] text-faint">比如这样写</p>
      <p className="measure-body mt-2 text-body text-muted">
        「/archive 里 2019-07-13 那场，标题写的是第二期，实际是第三期，
        录像 1:02:30 左右能看到标的是三。」
      </p>
      <p className="measure-body mt-3 text-meta text-faint">
        有能佐证的链接一起贴上来最好；拿不准也可以提，我会去核对。
        所有线索都进人工队列，不会自动改到档案上。
      </p>
    </div>
  )

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        aria-controls="correction-submission-panel"
        className="ui-card ui-press group w-full rounded-2xl border border-line bg-surface/55 p-6 text-left hover:border-live/40 sm:col-span-2"
      >
        {head}
      </button>
    )
  }

  return (
    <article className="ui-card rounded-2xl border border-live/40 bg-surface/55 p-6 sm:col-span-2">
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-expanded
        aria-controls="correction-submission-panel"
        className="ui-press block w-full text-left"
      >
        {head}
      </button>
      <div id="correction-submission-panel" className="ui-panel-in">
        {hint}
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
    </article>
  )
}
