import { LiveAlertAction } from '@/components/LiveAlertAction'
import { pageMetadata } from '@/lib/page-metadata'
export const metadata={...pageMetadata({path:'/live-alerts/confirm/',title:'确认开播提醒',description:'确认你的邮箱，接收下一次开播提醒。'}),robots:{index:false,follow:false},referrer:'no-referrer' as const}
export default function Page(){return <main className="mx-auto flex min-h-[100svh] max-w-xl items-center px-page py-12"><LiveAlertAction action="confirm" /></main>}
