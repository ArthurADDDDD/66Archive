'use client'

import { useState } from 'react'
import { SubmissionForm } from './SubmissionForm'

/**
 * 联系页的投稿入口。
 *
 * ## 为什么不是一张「发现哪里不对，写在这里」的卡
 *
 * 从前这里只有纠错一个说法，于是「我手上有一段站里没有的录像」「我存着 2016 年的老截图」
 * 这两类人在页面上找不到自己——他们要投的不是「哪里不对」。征集功能其实一直开着，
 * 只是没有一句话告诉人可以投什么。
 *
 * 现在先摆出三件具体的事，点哪一件，下面就展开哪一份填空模板。
 * 空白 textarea 换成模板不是装饰：后台收到的线索里，缺的永远是「哪一天」「在哪儿能看到」。
 *
 * ## 三件事走的是同一个队列
 *
 * 提交接口只区分 `correction` 与 `meme` 两个归属。这里三件事都属于前者，
 * 靠模板首行的方括号标记（【补一场】/【纠错】/【画廊线索】）在人工队列里分流——
 * 为了三个标签去改后台契约不划算，而人工队列本来就要逐条看。
 *
 * ## 折叠不只是排版
 *
 * SubmissionForm 一挂载就会拉一次配置接口、再渲染 Cloudflare Turnstile。
 * 也就是说只要有人打开联系页，哪怕根本没打算写，也会白白触发一次人机验证。
 * 表单放在条件渲染里，这些副作用就只在真的要写的时候才发生。
 */

type Intent = {
  id: string
  label: string
  hint: string
  /** 展开后写在表单上方的一句话 */
  lede: string
  bodyLabel: string
  template: string
}

const INTENTS: Intent[] = [
  {
    id: 'footage',
    label: '我有一场站里没有的',
    hint: '录像、切片、或者只是记得有这么一场',
    lede: '不用先找到链接。记得大概是哪一年、播的是什么，就已经够我去找了。',
    bodyLabel: '这一场大概是什么样的',
    template: '【补一场】\n· 大概什么时候：\n· 播的是什么（游戏 / 节目 / 事件）：\n· 在哪儿见过（有链接最好，没有也行）：\n',
  },
  {
    id: 'correction',
    label: '这里写错了',
    hint: '日期、标题、时长、链接、游戏标签',
    lede: '说清三件事就够：是哪条记录（贴页面地址最快）、哪里不对、正确的应该是什么。',
    bodyLabel: '发现了什么问题',
    template: '【纠错】\n· 哪条记录（贴页面地址最快）：\n· 哪里不对：\n· 正确的应该是：\n',
  },
  {
    id: 'photo',
    label: '我存着老图',
    hint: '周年图、生日贺图、直播间截图、粉丝作品',
    lede: '画廊一直在收。哪怕只记得「那年有一张什么图」，也可以先说一声。',
    bodyLabel: '这张图是什么',
    template: '【画廊线索】\n· 大概是哪一年：\n· 是什么画面：\n· 在哪儿能找到原图：\n',
  },
]

export function CorrectionSubmission() {
  const [openId, setOpenId] = useState<string | null>(null)
  const active = INTENTS.find((intent) => intent.id === openId) ?? null

  return (
    <article className="ui-card rounded-2xl border border-line bg-surface/55 p-6 sm:col-span-2">
      <span className="text-meta uppercase tracking-[0.16em] text-live">提交线索</span>
      <h2 className="mt-3 text-h3 font-medium">这份档案是大家一起补出来的</h2>
      <p className="measure-body mt-2 text-body text-muted">
        下面三件事，随便哪一件都欢迎。所有线索都进人工队列，由我逐条核对后再决定怎么改，不会自动生效。
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {INTENTS.map((intent) => {
          const selected = intent.id === openId
          return (
            <button
              key={intent.id}
              type="button"
              onClick={() => setOpenId(selected ? null : intent.id)}
              aria-expanded={selected}
              aria-controls="correction-submission-panel"
              className={`ui-press rounded-xl border p-4 text-left transition-colors ${
                selected
                  ? 'border-live/60 bg-live/10'
                  : 'border-line bg-base/25 hover:border-live/40 hover:bg-base/40'
              }`}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-control font-medium text-ink">{intent.label}</span>
                <span aria-hidden className={`shrink-0 font-mono text-meta text-live transition-transform ${selected ? 'rotate-45' : ''}`}>
                  +
                </span>
              </span>
              <span className="mt-1.5 block text-meta leading-relaxed text-faint">{intent.hint}</span>
            </button>
          )
        })}
      </div>

      {active && (
        <div id="correction-submission-panel" className="ui-panel-in mt-5 border-t border-line/70 pt-5">
          <p className="measure-body text-body text-muted">{active.lede}</p>
          <p className="measure-body mt-2 text-meta text-faint">
            下面的空按提示填就行，不用讲究格式。拿不准也可以提，我会去核对。
          </p>
          {/*
            key 让来意一换就重挂载，textarea 才会换成新模板。
            共用一个实例的话，React 会保住上一份 state，点了新按钮内容还是旧的那份。
          */}
          <SubmissionForm
            key={active.id}
            kind="correction"
            initialBody={active.template}
            className="mt-5"
            nameLabel="怎么称呼你"
            namePlaceholder="留个 ID 就行，方便我知道是谁发现的"
            bodyLabel={active.bodyLabel}
            bodyPlaceholder={active.template}
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
