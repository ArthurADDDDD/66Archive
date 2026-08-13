import { CalibrationVoting } from '@/components/CalibrationVoting'
import { BackToTop, MobileQuickNav } from '@/components/ScrollAffordances'
import { Container, PageHeader, SiteFooter } from '@/components/primitives'
import { SiteNav } from '@/components/SiteNav'

export default function CalibratePage() {
  return (
    <main className="ui-page-in min-h-screen">
      <MobileQuickNav active="calibrate" />
      <BackToTop />
      <header className="site-header-container flex items-center px-4 py-5 sm:px-6">
        <SiteNav active="calibrate" />
      </header>

      <Container className="pb-20 pt-14 sm:pt-20">
        <PageHeader
          eyebrow="Calibration · 真人校准"
          eyebrowColor="#5BC8E8"
          title="你看见的，可能比标题更准确。"
          lede="系统先根据标题和元数据识别游戏，再由路过的人从管理员给出的候选标签里判断。你的选择只进入待审核样本，最终仍由管理员核验。"
          wide
        />

        <div className="mt-12">
          <CalibrationVoting />
        </div>

        <section className="mt-10 grid gap-3 sm:grid-cols-3">
          <Note number="01" title="只点候选标签" body="不能搜索、创建或直接修改档案标签。" />
          <Note number="02" title="匿名但会去重" body="不注册账号；浏览器只保存一个匿名投票标识。" />
          <Note number="03" title="人工决定" body="票数是线索，不是事实。管理员采纳后仍要经过审阅。" />
        </section>
      </Container>

      <SiteFooter />
    </main>
  )
}

function Note({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <article className="rounded-2xl border border-line bg-surface/35 p-5">
      <span className="font-mono text-meta text-live tnum">{number}</span>
      <h2 className="mt-3 text-control font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-meta leading-relaxed text-muted">{body}</p>
    </article>
  )
}
