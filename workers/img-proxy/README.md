# chronicle-66 img-proxy

封面图代理。它不是通用远程图片入口，只处理经过明确审计、确实需要代理的来源；其它远程图片继续直连，站内图片永远不进入 Worker。

## 当前流量规则

代理 policy 的唯一来源是 [`src/lib/image-proxy-policy.ts`](../../src/lib/image-proxy-policy.ts)。前端 `proxyImage()` 和 Worker 都读取这一份配置，不再分别维护正则/allowlist。

当前 policy：

- `*.hdslb.com`（B 站）：允许进入 Worker；在 `NEXT_PUBLIC_IMG_PROXY` 未设置时继续使用 `images.weserv.nl`，保持现有生产行为。
- `*.acfun.cn`（A 站）：允许进入 Worker；在 `NEXT_PUBLIC_IMG_PROXY` 未设置时仍然直连，不因为源码里有 Worker 就提前改变生产流量。

不在 policy 的来源（目前包括 YouTube `i.ytimg.com`、斗鱼 `*.douyucdn.cn`、优酷 `*.ykimg.com`）始终原样返回，不会因为设置了 `NEXT_PUBLIC_IMG_PROXY` 就被送进 Worker。

`/gallery/**`、`/images/**` 以及其它以 `/` 开头的站内绝对路径同样始终原样返回。画廊性能优化是独立问题，不经过这个 Worker。

Worker 只做两件事：带上来源平台认可的 `Referer`；把请求交给 Cloudflare Image Resizing 按 `w` 缩放（账号未开通该能力时会退化为原图代理）。每次重定向都会重新检查同一份 policy，非允许 host 返回 403，避免变成开放代理。

## NEXT_PUBLIC_IMG_PROXY

这是**构建期变量**。设置后，只有共享 policy 内的 host 才会切到自有 Worker：

```text
NEXT_PUBLIC_IMG_PROXY=https://chronicle-66-img-proxy.<你的子域>.workers.dev
```

未设置时：

- B 站继续走现有 `images.weserv.nl` fallback；
- A 站继续直连；
- 所有不在 policy 的来源继续直连；
- 站内路径继续直连本站。

因此不要为了“试一下”直接在生产构建里打开变量。先部署 Worker，用真实封面测首请求、二次缓存、字节数与失败率，确认结果后再切。

## 本地测试

```bash
cd workers/img-proxy
npm install
npm run dev   # wrangler dev，只在本地跑，不碰任何线上资源
```

```bash
curl -s -o /tmp/t.jpg -w "%{http_code} %{size_download}\n" --get \
  --data-urlencode 'url=https://i0.hdslb.com/bfs/archive/真实封面.jpg' \
  --data-urlencode 'w=480' \
  'http://localhost:8787/'
file /tmp/t.jpg
```

还应验证拒绝非 policy host：

```bash
curl -i --get \
  --data-urlencode 'url=https://i.ytimg.com/vi/example/hqdefault.jpg' \
  'http://localhost:8787/'
# 预期：403
```

## 线上部署（必须由人操作）

```bash
cd workers/img-proxy
npx wrangler login    # 首次/登录失效时需要浏览器授权 Cloudflare 账号
npm run deploy
```

不要把 Cloudflare 凭据、token 或本机 wrangler 状态提交到仓库，也不要让 Agent 代为处理授权。

拿到 Worker URL 后，先直接请求 Worker 做真实性能测试；只有验证通过，才把 URL 注入实际发布流水线的 `NEXT_PUBLIC_IMG_PROXY` 构建变量并重新构建前台。

## 新增图片来源时

不要因为数据里出现了新 host 就自动把它加入代理。先确认：

1. 直连是否真的有防盗链、稳定性或传输体积问题；
2. 代理是否在真实网络测试中有明确收益；
3. 若需要代理，只修改 `src/lib/image-proxy-policy.ts` 这一份 policy；前端和 Worker 会同步使用；
4. 重新部署 Worker，并在前台发布前用真实 URL 测首请求、二次请求、状态码、实际图片字节数和内容类型。

policy 必须保持窄名单，不允许改成任意 URL 都能转发的开放代理。
