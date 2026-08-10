/** @type {import('next').NextConfig} */
const nextConfig = {
  // 全站静态导出：无服务端，部署到 Cloudflare Pages / Vercel 成本近零。
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
}

export default nextConfig
