'use client'

import { useState } from 'react'
import { SubmissionForm } from './SubmissionForm'
import { SiteText } from './SiteText'
import { useSiteTexts } from './LiveContentProvider'

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
 * 模板文字在后台可改；改的时候保留首行那个方括号标记，分流靠它。
 *
 * ## 折叠不只是排版
 *
 * SubmissionForm 一挂载就会拉一次配置接口、再渲染 Cloudflare Turnstile。
 * 也就是说只要有人打开联系页，哪怕根本没打算写，也会白白触发一次人机验证。
 * 表单放在条件渲染里，这些副作用就只在真的要写的时候才发生。
 */

type Intent = {
  id: string
  /** 这一种来意是否开放附图。只有「我存着老图」需要。 */
  photos?: boolean
  /** 以下都是页面文字的 id（见 `lib/site-copy.ts` 的 `texts`），文字本身在后台改 */
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
    label: 'contact-intent-footage-label',
    hint: 'contact-intent-footage-hint',
    lede: 'contact-intent-footage-lede',
    bodyLabel: 'contact-intent-footage-body-label',
    template: 'contact-intent-footage-template',
  },
  {
    id: 'correction',
    label: 'contact-intent-correction-label',
    hint: 'contact-intent-correction-hint',
    lede: 'contact-intent-correction-lede',
    bodyLabel: 'contact-intent-correction-body-label',
    template: 'contact-intent-correction-template',
  },
  {
    id: 'photo',
    photos: true,
    label: 'contact-intent-photo-label',
    hint: 'contact-intent-photo-hint',
    lede: 'contact-intent-photo-lede',
    bodyLabel: 'contact-intent-photo-body-label',
    template: 'contact-intent-photo-template',
  },
]

export function CorrectionSubmission() {
  const [openId, setOpenId] = useState<string | null>(null)
  const t = useSiteTexts()
  const active = INTENTS.find((intent) => intent.id === openId) ?? null

  return (
    <article className="ui-card rounded-2xl border border-line bg-surface/55 p-6 sm:col-span-2">
      <span className="text-meta uppercase tracking-[0.16em] text-live"><SiteText id="contact-submit-kicker" /></span>
      <h2 className="mt-3 text-h3 font-medium"><SiteText id="contact-submit-title" /></h2>
      <p className="measure-body mt-2 text-body text-muted">
        <SiteText id="contact-submit-intro" />
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
                <span className="text-control font-medium text-ink">{t(intent.label)}</span>
                <span aria-hidden className={`shrink-0 font-mono text-meta text-live transition-transform ${selected ? 'rotate-45' : ''}`}>
                  +
                </span>
              </span>
              <span className="mt-1.5 block text-meta leading-relaxed text-faint">{t(intent.hint)}</span>
            </button>
          )
        })}
      </div>

      {active && (
        <div id="correction-submission-panel" className="ui-panel-in mt-5 border-t border-line/70 pt-5">
          <p className="measure-body text-body text-muted">{t(active.lede)}</p>
          <p className="measure-body mt-2 text-meta text-faint">
            <SiteText id="contact-form-note" />
          </p>
          {/*
            key 让来意一换就重挂载，textarea 才会换成新模板。
            共用一个实例的话，React 会保住上一份 state，点了新按钮内容还是旧的那份。
          */}
          <SubmissionForm
            key={active.id}
            kind="correction"
            allowPhotos={active.photos === true}
            initialBody={t(active.template)}
            className="mt-5"
            nameLabel={t('contact-form-name-label')}
            namePlaceholder={t('contact-form-name-placeholder')}
            bodyLabel={t(active.bodyLabel)}
            bodyPlaceholder={t(active.template)}
            successMessage={t('contact-form-success')}
            disabledMessage={t('contact-form-disabled')}
            submitLabel={t('contact-form-submit')}
            againLabel={t('contact-form-again')}
          />
        </div>
      )}
    </article>
  )
}
