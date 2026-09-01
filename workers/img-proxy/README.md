# chronicle-66 img-proxy

封面图代理。它不是通用远程图片入口，只允许经过明确审计的来源做显式请求；前端是否把生产流量送进 Worker，则由同一份 policy 里的 `route` 单独决定。

## 当前生产流量规则

唯一 policy 来源是 [`src/lib/image-proxy-policy.ts`](../../src/lib/image-proxy-policy.ts)。前端 `proxyImage()` 和 Worker 都读取这一份配置，但区分两个概念：

- `route`：生产前端实际怎么取图；
- `workerAllowed`：这个 host 是否允许被显式送进 Worker 做测试/未来切换。

2026-09-01 对已部署 Worker 做真实 cold/warm 测量后的最终策略：

- `*.hdslb.com`（B 站）：**生产固定走 `images.weserv.nl`**。Worker 可以继续用于显式测试，但设置 `NEXT_PUBLIC_IMG_PROXY` 本身不会把 B 站切过去。
- `*.acfun.cn`（A 站）：**生产保持直连**。Worker 暖缓存和传输体积很好，但冷转换明显更慢，因此暂不作为默认生产路径。
- YouTube `i.ytimg.com`、斗鱼 `*.douyucdn.cn`、优酷 `*.ykimg.com`：继续直连，也不在 Worker allowlist。
- `/gallery/**`、`/images/**` 以及其它以 `/` 开头的站内路径：永远本站直出，不经过这个 Worker。

因此当前生产站**仍然依赖 `images.weserv.nl` 处理 B 站封面**，自有 Worker 已部署但不承接自动生产流量。

## 测量结论

测试使用真实封面、唯一 cache key 制造冷请求，再对完全相同 URL 发第二次请求观察暖缓存；另用不同地区的 GitHub Actions runner 交叉验证。关键结果在两个地区方向一致：

- B 站：Worker 的输出体积与 weserv 接近，但冷请求明显更慢，暖缓存也没有优于 weserv。
- A 站：Worker 可把约 589 KiB 的原图压到约 14 KiB，暖缓存非常快，但冷转换需要数秒，比原图直连更慢。
- YouTube / 斗鱼发给 Worker 均按预期返回 403，证明仍是窄名单而不是开放代理。

所以当前没有数据支持“为了迁移完整”把生产图片全量切到自有 Worker。

## NEXT_PUBLIC_IMG_PROXY

这是**构建期变量**，但它不再是全局开关。只有 policy 中 `route: 'worker'` 的 host 才会读取它：

```text
NEXT_PUBLIC_IMG_PROXY=https://chronicle-66-img-proxy.<你的子域>.workers.dev
```

当前 policy 没有任何 host 的生产 `route` 是 `worker`，所以即使误设这个变量，也不会改变 B 站、A 站、YouTube、斗鱼或优酷的生产路由。

如果未来某个 host 的真实冷/暖测试证明 Worker 更合适，应先把该 host 的 `route` 改为 `worker`，再把 Worker URL 接入实际发布流水线；变量缺失时按该 host 的 `fallback` 处理。

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

还应验证拒绝非 allowlist host：

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

## 新增图片来源时

不要因为数据里出现新 host 就自动加入代理。先确认：

1. 直连是否真的有防盗链、稳定性或传输体积问题；
2. 代理是否在真实 cold/warm 测试中有明确收益；
3. 若只需要允许 Worker 做测试，可设 `workerAllowed: true`，但保持生产 `route` 不变；
4. 只有确认 Worker 更优时，才把生产 `route` 改为 `worker` 并接入构建变量；
5. 每次改动都要重新验证真实图片字节数、状态码、冷请求与缓存后二次请求。

policy 必须保持窄名单，不允许改成任意 URL 都能转发的开放代理。
