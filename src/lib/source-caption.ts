/**
 * 来源卡片的第二行：优先读者说明；其次是它原属条目的标题，但和本页标题一样时不重复——
 * 否则同一场的几个来源会显示一模一样的一行字，看不出区别。
 */
export function sourceCaption(source: { label?: string; entryTitle: string }, pageTitle: string): string | null {
  if (source.label) return source.label
  return source.entryTitle !== pageTitle ? source.entryTitle : null
}
