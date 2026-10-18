# 浏览器开播通知（Web Push）

首页「开播提醒」弹窗里，邮件提醒之外另有「浏览器通知」。两者相互独立：可以只开一种，也可以都开；开启浏览器通知不需要邮箱或账号，也不等于同意邮件提醒。

接口不可用、服务关闭或处于测试阶段（且没有测试码）时，弹窗不显示浏览器通知这一块，界面与原来的邮件订阅完全相同。

## 公开接口

前台请求同域接口（本地联调同样可用 `NEXT_PUBLIC_CONTENT_ORIGIN`）。所有响应 no-store；写请求要求同源 `Origin`、JSON、2 KiB 以内，并有频率限制。

- `GET /api/live-alerts/push` → `{"enabled":false}`，或 `{"enabled":true,"mode":"public"|"test","publicKey":"<VAPID 公钥>"}`。
- `POST /api/live-alerts/push/subscribe`：`{"subscription":<PushSubscription.toJSON()>,"consent":true,"client":{"browser","platform","standalone"},"testCode"?}` → 201 `{"status":"subscribed","token":"…"}`。
- `POST /api/live-alerts/push/unsubscribe`、`/status`、`/test`、`/renew`：都要带订阅时拿到的设备令牌 `token`。只知道推送地址不能操作订阅。`/test` 给这台设备发一条测试通知（每小时最多 3 次）。

设备令牌存在浏览器的 IndexedDB（`nvliu-live-alerts`）里，服务端只保存它的校验值。重新开启同一个浏览器会换发新令牌，旧令牌随即失效。

只接受各浏览器厂商推送服务的地址（Google FCM、Mozilla、Apple、Microsoft WNS），按主机名精确匹配。

## 前台流程

1. 打开弹窗只做能力检测：不申请权限，也不注册 service worker。
2. 点击「开启浏览器通知」后，在同一次点击里申请通知权限（Safari 要求），再注册 `/sw.js`、订阅、交给服务端登记。服务端确认后才显示“已开启”。
3. 被拒绝时不再反复弹出权限请求，只说明如何在网站设置里重新允许。
4. 订阅失败（典型情况是浏览器连不上自己的推送服务）时如实提示，建议换浏览器或用邮件提醒。
5. 已开启的设备可以「发送测试通知」或「关闭」。

推送服务受理不等于通知已经显示：系统通知设置、勿扰模式、省电策略和网络都会影响。界面不把“已开启”说成“保证送达”。

## service worker

`public/sw.js` 只处理 `push`、`notificationclick`、`pushsubscriptionchange`：

- **没有 `fetch` 处理器、没有缓存、没有离线功能**，不会缓存或代答任何页面、数据或接口。
- 每条推送都显示一条通知（浏览器要求）；同一场直播的通知用同一个 `tag`，重复送达只会替换前一条。点击只会打开站内地址或 `https://live.douyin.com/` 下的直播间。
- 只在访客开启浏览器通知后注册，作用域 `/`，`updateViaCache: 'none'`；更新时 `skipWaiting` 立即生效。

### 版本与更新

改动 `sw.js` 时同时改 `SW_VERSION`。浏览器在导航时会绕过 HTTP 缓存检查 `sw.js` 的更新；它和其他静态文件一样随站点发布，边缘最多短暂缓存，不需要额外清缓存。

### 回滚

- 回滚到没有 `sw.js` 的旧版前台时，浏览器取不到新脚本，会**继续使用已经安装的版本**，不会自动注销。这份脚本没有 fetch 处理器，留着不影响页面，只是继续显示推送。
- 只想停止推送：关闭服务端的推送服务即可，不需要动前台。

### 紧急停用（kill switch）

确需让所有浏览器注销这个 service worker 时，把 `public/sw.js` 换成下面的内容发布（不要删除文件，否则旧版本会一直留在浏览器里）：

```js
// kill switch: unregister and stop showing notifications. Push subscriptions are dropped with the registration.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.registration.unregister()))
self.addEventListener('push', event => event.waitUntil(self.registration.showNotification('女流档案馆', { body: '浏览器通知已停用。', tag: 'nvliu-alert' })))
```

注销会连带取消这些浏览器的推送订阅，之后服务端发送会收到失效响应并自动清理。恢复功能时再发布正常版本，访客需要重新开启。

## manifest 与图标

`public/manifest.json`（`id` 固定为 `/`，`display: standalone`）和 `public/icons/` 是为 iPhone / iPad 主屏幕 Web App 准备的：iOS 只在从主屏幕图标打开的页面里提供网页推送。manifest 不带任何缓存规则。有了 manifest，Android Chrome 可能自动提示安装，`layout.tsx` 拦下了这个自动提示；浏览器菜单里的手动安装不受影响。

图标源文件与渲染脚本在 `scripts/icons/`，原创图形（铃铛 + “66”），不使用照片。

## 测试设备

测试阶段只有持有后台生成的一次性测试码的设备会看到浏览器通知：打开 `https://nvliu.wiki/#push-test=<测试码>`，弹窗会自动打开，测试码随即从地址栏移除。iPhone / iPad 先从这个链接添加到主屏幕，再从主屏幕打开，在弹窗里输入测试码。

## 平台差异（需真机验证）

| 平台 | 预期 |
|---|---|
| Windows / macOS 的 Chrome、Edge、Firefox | 标准网页推送。Chrome 依赖 Google 推送服务，在无法访问 Google 的网络里通常订阅失败 |
| macOS Safari 16.1+ | 支持 |
| iPhone / iPad（iOS / iPadOS 16.4+） | 仅限添加到主屏幕后从图标打开；普通 Safari / Chrome 标签页不支持 |
| Android Chrome | 需要 Google Play 服务并能连上 Google 推送服务；国内手机常不可用 |
| 国内 Android 自带浏览器、UC、QQ、夸克等 | 多数没有可用的网页推送，提示改用邮件 |
| 微信、QQ 等应用内浏览器 | 不支持，提示在系统浏览器中打开 |
