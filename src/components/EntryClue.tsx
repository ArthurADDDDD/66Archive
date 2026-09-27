'use client'

import { useState } from 'react'
import { SubmissionForm } from './SubmissionForm'
import { useSiteTexts } from './LiveContentProvider'

/**
 * 「这场还没找到录像 / 录像不全」的线索入口。
 *
 * 档案里有一百多条只知道「这天开过播」的占位条目——日期、标题来自节目单或贴吧记录，
 * 但没有一个能打开的链接。看到这一条的人，恰好是最可能记得「这场我在哪儿看过」的人，
 * 让他再绕去联系页、自己把日期标题抄一遍，大多数人就不写了。所以入口放在条目上，
 * 模板里预先填好是哪一场。
 *
 * 走的是联系页同一个 `correction` 队列，首行【补录像】标记在人工队列里分流
 * （与【补一场】【纠错】【画廊线索】同一套约定，见 CorrectionSubmission）。
 *
 * 表单折叠在按钮后面：SubmissionForm 一挂载就拉配置、渲染 Turnstile，
 * 两千多张条目页不能因为这个入口每页多一次人机验证。
 */
export function EntryClue({
  entry,
  className,
}: {
  entry: { id: string; date: string; title: string; sourceCount: number; aliveCount: number; missingFootage?: string }
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const t = useSiteTexts()
  // 有能看的录像时只可能是「录像不全」；否则按有没有来源分「没找到」和「都失效了」。
  const variant = entry.aliveCount > 0 && entry.missingFootage ? 'partial' : entry.sourceCount === 0 ? 'none' : 'dead'
  const link = typeof window === 'undefined' ? `/e/${entry.id}/` : `${window.location.origin}/e/${entry.id}/`
  const template = t('entry-clue-template', { date: entry.date, title: entry.title, link })
  const title =
    variant === 'partial'
      ? t('entry-clue-title-partial', { missing: entry.missingFootage ?? '' })
      : variant === 'none'
        ? t('entry-clue-title-none')
        : t('entry-clue-title-dead')

  return (
    <section className={`rounded-xl border border-dashed border-live/35 bg-live/[0.04] p-3.5 sm:p-4 ${className ?? ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-control font-medium text-ink">
            {title}
          </p>
          <p className="measure-note mt-1 text-meta leading-relaxed text-muted">{t('entry-clue-intro')}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={`entry-clue-${entry.id}`}
          className={`ui-press min-h-10 shrink-0 rounded-full border px-4 text-meta transition-colors ${open ? 'border-line text-muted hover:text-ink' : 'border-live/55 text-live hover:bg-live/10'}`}
        >
          {open ? t('entry-clue-close') : t('entry-clue-open')}
        </button>
      </div>

      {open && (
        <div id={`entry-clue-${entry.id}`} className="ui-panel-in mt-4 border-t border-line/70 pt-4">
          <SubmissionForm
            kind="correction"
            initialBody={template}
            nameLabel={t('contact-form-name-label')}
            namePlaceholder={t('contact-form-name-placeholder')}
            bodyLabel={t('entry-clue-body-label')}
            bodyPlaceholder={template}
            successMessage={t('entry-clue-success')}
            disabledMessage={t('contact-form-disabled')}
            submitLabel={t('contact-form-submit')}
            againLabel={t('contact-form-again')}
          />
        </div>
      )}
    </section>
  )
}
