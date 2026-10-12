import Link from 'next/link'
import { pageMetadata } from '@/lib/page-metadata'
import { SiteFooter } from '@/components/primitives'
export const metadata=pageMetadata({path:'/privacy/',title:'开播提醒隐私说明',description:'开播提醒收集哪些信息、如何使用，以及怎样退订。'})
export default function Privacy(){return <main className="min-h-screen">
  <article className="site-container max-w-3xl px-page py-14 sm:py-20">
    <Link href="/" className="text-meta text-live hover:underline">← 回到首页</Link>
    <p className="mt-10 text-meta text-faint">更新于 2026 年 10 月 12 日 · 开播提醒服务</p>
    <h1 className="mt-3 text-h1 font-semibold text-ink">你的邮箱，只用来提醒开播。</h1>
    <div className="mt-8 space-y-8 text-body leading-relaxed text-muted">
      <p>本站是独立维护的粉丝档案站，非主播官方站点。这份说明针对开播提醒服务；只有订阅功能开放、你主动填写邮箱并点击邮件中的确认按钮后，才会接收开播提醒。</p>
      <section><h2 className="mb-3 text-h3 font-semibold text-ink">我们收集什么</h2><p>你填写的邮箱、申请与确认订阅的时间、同意的说明版本，以及必要的邮件发送状态。为限制恶意请求，我们还会短暂保存根据请求来源地址生成的不可直接读取原地址的校验标识及请求次数；这些限流记录会在两天后清理。邮箱不会公开显示，也不会用于广告或出售给其他人。</p></section>
      <section><h2 className="mb-3 text-h3 font-semibold text-ink">邮件什么时候发送</h2><p>申请订阅时先发送确认邮件。确认后，本站监测到女流66在抖音开启新的直播场次时发送提醒。同一场次通常只提醒一次；观测和邮件投递可能有延迟，不能保证即时到达。未确认的申请不会收到开播提醒。</p></section>
      <section><h2 className="mb-3 text-h3 font-semibold text-ink">邮件服务商会处理哪些信息</h2><p>发送时，所选邮件服务商需要处理你的邮箱和邮件内容，包括其中的确认或退订链接。本站可使用 Resend、Brevo 或 Mailjet 按可用额度发送，不会把你的地址加入它们的独立营销名单。这些服务商可能在境外处理数据，具体处理与保留方式见它们的隐私说明。</p><p className="mt-3 flex flex-wrap gap-5"><a href="https://resend.com/legal/privacy-policy" rel="noreferrer" target="_blank" className="text-live underline">Resend</a><a href="https://www.brevo.com/legal/privacypolicy/" rel="noreferrer" target="_blank" className="text-live underline">Brevo</a><a href="https://www.mailjet.com/legal/privacy-policy/" rel="noreferrer" target="_blank" className="text-live underline">Mailjet</a></p></section>
      <section><h2 className="mb-3 text-h3 font-semibold text-ink">保存与退订</h2><p>有效订阅期间保存邮箱与确认记录；未确认的申请在三十天后清理。每封开播提醒都包含退订入口，无需登录。退订后，邮箱会从订阅收件列表移除；本站保留不包含明文邮箱的订阅校验标识，以处理重复操作。必要的发送记录最多保留三十天，邮件服务商的记录按它们各自的规则处理。已经发出的邮件无法撤回。</p></section>
      <section><h2 className="mb-3 text-h3 font-semibold text-ink">请求帮助</h2><p>如果需要查询、删除订阅信息，或遇到退订问题，可通过<Link href="/contact/" className="text-live underline">联系我们</Link>页面联系维护者。请不要公开贴出确认或退订链接，它们可以操作你的订阅。</p></section>
    </div>
  </article><SiteFooter />
  </main>}
