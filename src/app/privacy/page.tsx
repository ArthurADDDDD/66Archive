import Link from 'next/link'
import { SiteText } from '@/components/SiteText'
import { pageMetadata } from '@/lib/page-metadata'
import { SiteFooter } from '@/components/primitives'
export const metadata=pageMetadata({path:'/privacy/',title:'开播提醒隐私说明',description:'开播提醒（邮件与浏览器通知）收集哪些信息、如何使用，以及怎样退订或关闭。'})
export default function Privacy(){return <main className="min-h-screen">
  <article className="site-container max-w-3xl px-page py-14 sm:py-20">
    <Link href="/" className="text-meta text-live hover:underline"><SiteText id="privacy-back" /></Link>
    <p className="mt-10 text-meta text-faint"><SiteText id="privacy-updated" /></p>
    <h1 className="mt-3 text-h1 font-semibold text-ink"><SiteText id="privacy-title" /></h1>
    <div className="mt-8 space-y-8 text-body leading-relaxed text-muted">
      <p><SiteText id="privacy-intro" /></p>
      <section><h2 className="mb-3 text-h3 font-semibold text-ink"><SiteText id="privacy-collect-title" /></h2><p><SiteText id="privacy-collect-body" /></p></section>
      <section><h2 className="mb-3 text-h3 font-semibold text-ink"><SiteText id="privacy-mail-title" /></h2><p><SiteText id="privacy-mail-body" /></p></section>
      <section><h2 className="mb-3 text-h3 font-semibold text-ink"><SiteText id="privacy-providers-title" /></h2><p><SiteText id="privacy-providers-body" /></p><p className="mt-3 flex flex-wrap gap-5"><a href="https://resend.com/legal/privacy-policy" rel="noreferrer" target="_blank" className="text-live underline">Resend</a><a href="https://www.brevo.com/legal/privacypolicy/" rel="noreferrer" target="_blank" className="text-live underline">Brevo</a><a href="https://www.mailjet.com/legal/privacy-policy/" rel="noreferrer" target="_blank" className="text-live underline">Mailjet</a></p></section>
      <section><h2 className="mb-3 text-h3 font-semibold text-ink"><SiteText id="privacy-retention-title" /></h2><p><SiteText id="privacy-retention-body" /></p></section>
      <section><h2 className="mb-3 text-h3 font-semibold text-ink"><SiteText id="privacy-push-title" /></h2><p><SiteText id="privacy-push-body1" /></p><p className="mt-3"><SiteText id="privacy-push-body2" /></p><p className="mt-3"><SiteText id="privacy-push-body3" /></p></section>
      <section><h2 className="mb-3 text-h3 font-semibold text-ink"><SiteText id="privacy-help-title" /></h2><p><SiteText id="privacy-help-before" /><Link href="/contact/" className="text-live underline"><SiteText id="privacy-help-link" /></Link><SiteText id="privacy-help-after" /></p></section>
    </div>
  </article><SiteFooter />
  </main>}
