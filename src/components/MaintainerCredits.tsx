'use client'

import { useSiteCopy } from './LiveContentProvider'

/**
 * 联系页「维护」那一栏。
 *
 * 单独拆成客户端组件，是因为名单本身是会变的内容（谁在名单里、谁排在前面），
 * 通过内容服务下发；页面其余部分仍然是服务端渲染。内容服务拿不到时
 * `useSiteCopy` 返回的就是 `site-copy.ts` 里的基线，这一栏照常显示。
 */
export function MaintainerCredits() {
  const { maintainers } = useSiteCopy()
  if (maintainers.length === 0) return null
  return (
    <div className="rounded-2xl border border-line bg-surface/55 p-6">
      <span className="text-meta uppercase tracking-[0.16em] text-faint">维护</span>
      <ul className="mt-4 space-y-4">
        {maintainers.map((person) => (
          <li key={person.id}>
            <p className="text-h3 font-medium text-ink">{person.name}</p>
            {person.role && <p className="mt-1 text-meta text-faint">{person.role}</p>}
          </li>
        ))}
      </ul>
      <p className="mt-6 border-t border-line/70 pt-4 text-meta text-faint">
        想一起补档或校对，可以从上面的 GitHub 仓库找到我。
      </p>
    </div>
  )
}
