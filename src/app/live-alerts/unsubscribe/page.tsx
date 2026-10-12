import { LiveAlertAction } from '@/components/LiveAlertAction'
import { pageMetadata } from '@/lib/page-metadata'
export const metadata={...pageMetadata({path:'/live-alerts/unsubscribe/',title:'退订开播提醒',description:'停止接收开播提醒邮件。'}),robots:{index:false,follow:false},referrer:'no-referrer' as const}
export default function Page(){return <main className="mx-auto flex min-h-[100svh] max-w-xl items-center px-page py-12"><LiveAlertAction action="unsubscribe" /></main>}
