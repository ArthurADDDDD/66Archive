# chronicle-66 img-proxy

封面图代理，替代 `src/lib/platforms.ts` 里临时用的 `images.weserv.nl`。

只做两件事：带上各平台自己认可的 `Referer` 绕开防盗链；把请求交给 Cloudflare Image Resizing 按 `w` 缩放（账号未开通该功能时会静默跳过，退化为原图代理，不会报错）。

只允许经过白名单的三个域名（数据里实际出现过的封面来源）：`hdslb.com`（B 站）、`acfun.cn`（A 站）、`ykimg.com`（优酷）。其他域名一律 403，避免被当成开放代理。

## 本地测试

```bash
cd workers/img-proxy
npm install
npm run dev   # wrangler dev，只在本地跑，不碰任何线上资源
```

```bash
curl "http://localhost:8787/?url=$(python3 -c "import urllib.parse;print(urllib.parse.quote('https://i2.hdslb.com/bfs/archive/xxx.jpg',safe=''))")&w=200"
```

## 部署（需要人操作，不要让 Agent 自动跑）

```bash
cd workers/img-proxy
npx wrangler login    # 第一次需要授权 Cloudflare 账号
npm run deploy
```

部署后会得到一个 `https://chronicle-66-img-proxy.<你的子域>.workers.dev` 地址。

把它填进主站的构建环境变量 `NEXT_PUBLIC_IMG_PROXY`（Cloudflare Pages / Vercel 的项目设置里，或本地 `.env.local`），主站 `proxyImage()` 会自动切换过去，不用改代码。不设这个变量时主站会退回现在的 `weserv.nl` 兜底代理，照常能用。

## 数据侧接入新的封面图域名时，要同步改两个地方

白名单是刻意做窄的：只放行数据里实际出现过的域名，不做成开放代理。所以每次采集侧（角色 B）引入一个新平台的封面来源（比如抖音自己的图床，而不是复用 B 站/A 站转载），封面会直接原样返回、不经过代理——如果新域名本身有防盗链，图会挂掉，但不会报错，容易被漏掉，要主动查。

发现新域名后（`npm run validate` 不会检查这个，得靠人工比对，或者跑一遍下面的采样脚本）：

1. **`src/lib/platforms.ts`** 的 `IMAGE_PROXY_HOST` 正则里加一段 `(^|\.)新域名$`。
2. **`workers/img-proxy/src/index.ts`** 的 `ALLOWED_ORIGINS` 里加一条 `{ host: /(^|\.)新域名$/, referer: '这个平台自己域名下的一个合法页面 URL' }`——referer 选错的话对方照样会拦，选平台自己的首页或播放页域名通常最稳。
3. 改完 Worker 要重新 `npm run deploy`（走人工确认，见上面部署那节）；`platforms.ts` 的改动跟主站代码一起走正常构建部署流程即可。
4. 部署后用真实 URL 测一遍，不要只看 HTTP 状态码，图片字节数和 `file` 输出也要看（防盗链有时候会返回 200 但给一张占位图）：
   ```bash
   curl -s -o /tmp/t.jpg -w "%{http_code} %{size_download}\n" --get \
     --data-urlencode 'url=https://新域名/真实封面路径.jpg' \
     'https://chronicle-66-img-proxy.<子域>.workers.dev/'
   file /tmp/t.jpg
   ```

排查新域名用这个（跑一遍 `data/entries/**` 里所有 `cover` 字段的域名分布，跟当前白名单比对）：
```bash
node -e "
const fs=require('fs'),path=require('path'),yaml=require('js-yaml');
const dir='data/entries';
const hosts={};
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.yaml'))){
  for(const e of yaml.load(fs.readFileSync(path.join(dir,f),'utf8'))||[]){
    if(!e.cover) continue;
    try{ hosts[new URL(e.cover).hostname]=(hosts[new URL(e.cover).hostname]||0)+1 }catch{}
  }
}
console.log(hosts)
"
```
