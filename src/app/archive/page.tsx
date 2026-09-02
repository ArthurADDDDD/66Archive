import type { Metadata } from 'next'
import { BackToTop } from '@/components/ScrollAffordances'
import { ArchiveLoader } from '@/components/ArchiveLoader'

/** canonical 指向自身的 apex 地址。根 layout 只给 metadataBase，canonical 必须各页自己声明。 */
export const metadata: Metadata = {
  alternates: { canonical: '/archive/' },
}

/**
 * 录播室：档案模式。完整 Timeline，能力一条不丢，搜索/筛选/年份/来源全部保留。
 * 深链（?y=/?m=/?q=/?p=/?t=/?g=/?alive=）由 Timeline 自己在客户端恢复
 * （静态导出无法在服务端读 searchParams）。
 */
export default function ArchivePage() {
  return (
    <>
      <ArchiveLoader />
      <BackToTop />
    </>
  )
}
