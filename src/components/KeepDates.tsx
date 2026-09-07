import { Fragment, type ReactNode } from 'react'

/** ISO 日期里的连字符是浏览器合法的断行点：窄栏里 `2019-04-21` 会被折成
 * 「2019-」+「04-21」，读起来像两个数字而不是一个日期。日期是一个整体，
 * 不能从中间断开——把正文里出现的日期各自包成不换行的一段，其余照常折行。 */
const ISO_DATE = /\d{4}-\d{2}-\d{2}/g

export function keepDates(text: string): ReactNode {
  const parts: ReactNode[] = []
  let cursor = 0
  ISO_DATE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ISO_DATE.exec(text))) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index))
    parts.push(
      <span key={`${match.index}-${match[0]}`} className="whitespace-nowrap tnum">
        {match[0]}
      </span>,
    )
    cursor = match.index + match[0].length
  }
  if (parts.length === 0) return text
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts.map((part, i) => <Fragment key={i}>{part}</Fragment>)
}

/** `keepDates` 的组件写法，正文段落直接 `<KeepDates text={...} />`。 */
export function KeepDates({ text }: { text: string }) {
  return <>{keepDates(text)}</>
}
