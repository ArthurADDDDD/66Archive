import Link from 'next/link'

/**
 * 站内 404。
 *
 * 刻意**不引入任何客户端组件**（不放 SiteNav / SiteFooter）：没有这个文件时 Next 会把
 * 自带的默认 404 组件树序列化进每一个页面的 RSC 载荷，而换上的这一份同样是每页都要付。
 * 实测带 SiteNav 的版本在 /archive/ 上反而 +248 B——落地页做得越全，全站每页越贵。
 * 所以这里只有静态标签和两个链接。
 */
export default function NotFound() {
  return (
    <main className="ui-page-in site-container min-h-screen px-page py-24 sm:py-32">
      <p className="font-mono text-meta uppercase tracking-[0.16em] text-live tnum">404</p>
      <h1 className="measure-hero mt-3 text-h1 font-semibold">这个地址下面没有东西。</h1>
      <p className="measure-body mt-4 text-body text-muted">
        可能是链接写错了，也可能是这条记录还没有被收录。从录播室按年份和月份翻找通常最快。
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/archive/" prefetch={false} className="ui-press rounded-full border border-live/60 bg-live/5 px-5 py-2.5 text-control text-live hover:bg-live/10">
          去录播室找 →
        </Link>
        <Link href="/" prefetch={false} className="ui-press rounded-full border border-line px-5 py-2.5 text-control text-muted hover:border-muted hover:text-ink">
          回首页
        </Link>
      </div>
    </main>
  )
}
