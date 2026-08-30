/**
 * 数据页的一节：一个问题 + 图 + 观察。
 *
 * 之所以从 `app/stats/page.tsx` 里抽出来：有些小节的数据要到运行期才知道有没有
 * （比如「水友们最爱看」要等内容服务回话）。这类小节必须能在客户端决定
 * 「整节都不渲染」——接口没通就留一个空标题在页面上，比没有这一节更难看。
 * 所以它得是一个服务端和客户端都能用的纯展示组件。
 */
export function StatsSection({
  question,
  accent,
  legend,
  children,
}: {
  question: string
  accent: string
  /** 图形的读法：这一节的图怎么看，一句话写在标题下面 */
  legend?: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-line">
      <div className="site-container-wide px-page py-[clamp(3rem,8vh,7rem)]">
        <p className="flex items-center gap-2 text-meta uppercase tracking-[0.16em] text-faint">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
          一个问题
        </p>
        <h2 className="mt-3 max-w-[min(100%,72rem)] text-[clamp(2rem,3vw,4rem)] font-semibold leading-[1.12] tracking-[-0.02em] text-ink">{question}</h2>
        {legend && <p className="measure-body mt-3 text-meta text-muted">{legend}</p>}
        <div className="mt-6 w-full">{children}</div>
      </div>
    </section>
  )
}
