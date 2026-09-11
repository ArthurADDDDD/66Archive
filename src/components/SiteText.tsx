'use client'

import { Fragment, type ReactNode } from 'react'
import { splitSiteText } from '@/lib/site-copy'
import { useSiteText } from './LiveContentProvider'

/**
 * 一句页面文字（见 `lib/site-copy.ts` 的 `texts`）。服务端组件也能直接用。
 *
 * `vars` 把句子里的 `{name}` 换成值；值可以是带样式的节点（比如等宽加粗的数字）。
 * 后台把某个占位符删掉，那个值就不出现——这是写文案的人的选择，不是错误。
 */
export function SiteText({ id, vars }: { id: string; vars?: Record<string, ReactNode> }) {
  const text = useSiteText(id)
  if (!vars) return <>{text}</>
  return (
    <>
      {splitSiteText(text).map((part, index) =>
        part.kind === 'text' ? (
          <Fragment key={index}>{part.value}</Fragment>
        ) : (
          <Fragment key={index}>{part.name in vars ? vars[part.name] : `{${part.name}}`}</Fragment>
        ),
      )}
    </>
  )
}

/** 多段文字：一行一段，每段一个 `<p>`。 */
export function SiteTextParagraphs({ id, className }: { id: string; className?: string }) {
  const text = useSiteText(id)
  return (
    <>
      {text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')
        .map((line, index) => (
          <p key={index} className={className}>
            {line}
          </p>
        ))}
    </>
  )
}
