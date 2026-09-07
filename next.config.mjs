/** @type {import('next').NextConfig} */
const nextConfig = {
  // 全站静态导出：无服务端，部署到 Cloudflare Pages / Vercel 成本近零。
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  /**
   * 把发布流水线传进来的站点地址钉进构建产物，服务端与客户端拿到同一个字符串。
   *
   * 埋点要判断「这条链接是不是站内的」——后台填跳转地址时多半会贴完整 URL 而不是
   * 站内路径。这个判断在服务端渲染和浏览器里必须得出同一个答案：`process.env.SITE_ORIGIN`
   * 只存在于服务端，客户端会退回兜底常量，两边不一致就会在属性上产生水合告警。
   *
   * 没设置时留空字符串，由 site-url.ts 的 FALLBACK_SITE_ORIGIN 兜底——域名仍然只在
   * 那一个地方出现。
   */
  env: {
    NEXT_PUBLIC_SITE_ORIGIN: (process.env.SITE_ORIGIN ?? '').replace(/\/$/, ''),
  },
}

export default nextConfig
