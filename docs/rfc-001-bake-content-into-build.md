# RFC 001 — 构建期烤入后台文案

状态：**待实施** · 角色：架构/契约出稿，前端角色实施 · 日期：2026-08-23

---

## 1. 背景

前台文案有两层（见 [AGENTS.md](../AGENTS.md)「前台文案的两层来源」）：

1. **公仓基线**——`src/lib/narrative.ts` / `src/lib/site-copy.ts` 里的值，SSG 出来的 HTML 就是这一层
2. **后台当前值**——首屏后由浏览器拉只读内容接口，按稳定 id 覆盖上去

问题出在这两层的**落差**上。基线是写死在代码里的值，可能几个月没动过；后台当前值才是运营者真正想让人看到的东西。于是：

- **每次页面加载都闪一下旧文案**。SSG 的 HTML 先渲染基线，客户端拉到内容后重渲染，中间 100–300ms 访客看到的是几个月前的文案。
- **一旦请求失败，就退回那个几个月前的值**，而不是"稍旧一点"的值。2026-08-23 排查过一次真实故障：接口失败率约 12%，前台大面积显示旧文案，运营者反复保存也"改不动"，因为问题根本不在保存。
- **爬虫永远只看到基线**，后台写的文案对 SEO 完全不存在。

底层原因是：**兜底值选错了**。挑一个几个月前的硬编码值当兜底，等于让任何一次瞬时故障都把页面打回很久以前的状态。

## 2. 目标 / 非目标

**目标**

- G1 SSG 出来的 HTML 直接就是后台文案，消除加载时的基线闪烁
- G2 接口不可用时，兜底值是「上次部署时的后台文案」，而不是硬编码基线
- G3 爬虫看到的从"永远的基线"改善为"上次部署时的后台文案"

**非目标（明确不做）**

- N1 **不改变编辑链路。改文案仍然立刻生效，不需要部署。** 这是本 RFC 的硬约束，任何让"改文案要重新部署"的实现都是错的。
- N2 不追求实时 SEO——那要放弃静态导出改成请求时渲染，不在本 RFC 范围
- N3 不合并三个内容端点（独立议题，见 §8）

## 3. 方案

一句话：**把 `LiveContentProvider` 的初始 state 从三个 `null` 换成构建期抓下来的后台内容。**

因为全站是 `output: 'export'`，服务端组件在构建期执行；而 `'use client'` 组件在静态导出时同样会被服务端渲染一遍来产出 HTML。所以只要 Provider 带着内容渲染，`HighlightStrip` 这些读 context 的组件在 SSG 阶段就已经把覆盖应用上了——**`page.tsx` 等取数逻辑一行都不用改**。

```
构建期   拉一次只读内容接口 ──► 作为 initial 喂给 LiveContentProvider
                                      │
                                      ├─► SSG 渲染：HTML 里就是后台文案   （G1 G3）
                                      │
运行期   浏览器再拉一次实时内容 ───────┴─► 有则更新（编辑立刻生效，N1）
                                          拉失败 → 保留烤入值，不回退硬编码（G2）
```

复用点：`live-content.ts` 里的 `parseNarrative` / `parseSiteCopy` / `parseEditorial` 和那几个 `applyLive*` 覆盖函数**都是纯函数，服务端与客户端都能跑**（文件注释已写明）。本 RFC 不新增任何校验或覆盖逻辑，两侧走完全相同的代码路径。

## 4. 契约

### 4.1 新模块 `src/lib/baked-content.ts`

```ts
export async function fetchBakedContent(): Promise<LiveContent>
```

行为：

| 情况 | 行为 |
|---|---|
| `CONTENT_BAKE_ORIGIN` 未设置 | 返回三个 `null`，行为与今天完全一致（本地 dev 默认走这条） |
| 三个端点都成功 | 返回解析后的 `LiveContent` |
| 部分/全部失败，且 `CONTENT_BAKE_REQUIRED` ≠ `1` | 失败的那份记 `null`，**在构建日志里显著告警**，构建继续 |
| 部分/全部失败，且 `CONTENT_BAKE_REQUIRED` = `1` | **抛错，让构建失败** |

要点：

- 用 `cache: 'no-store'`，并用 `React.cache()` 包一层——`generateMetadata` 和 `RootLayout` 都会调它，必须只实际请求一次
- 解析一律复用 `live-content.ts` 现成的 parser，**不要另写一套校验**
- 建议加 `import 'server-only'` 防止被误引入客户端 bundle（需装 `server-only` 包；不装的话至少在文件头注释写明「只允许服务端组件引用」）

### 4.2 环境变量

| 变量 | 用途 | 谁设置 |
|---|---|---|
| `CONTENT_BAKE_ORIGIN` | 构建期去哪拉内容接口，如 `https://<站点域名>` | 发布流水线 |
| `CONTENT_BAKE_REQUIRED` | 设为 `1` 时，拉不到就让构建失败 | 发布流水线设 `1` |

两个都**不要**写进仓库任何文件的默认值里。本地不设 → 自动退回今天的行为。

### 4.3 跨仓改动（私有后台仓，不在本仓范围）

私有后台仓的发布流水线在构建本仓静态站时，需要注入上面两个环境变量（`CONTENT_BAKE_REQUIRED=1`）。这一侧的改动由有该仓权限的人执行，本 RFC 只定义契约。

## 5. 实施清单

**T1 — 新增 `src/lib/baked-content.ts`**，按 §4.1 实现。

**T2 — `src/components/LiveContentProvider.tsx` 接受初始值**

```tsx
export function LiveContentProvider({
  children,
  initial,
}: { children: React.ReactNode; initial?: LiveContent }) {
  const [content, setContent] = useState<LiveContent>(
    initial ?? { narrative: null, copy: null, editorial: null },
  )
  ...
}
```

> ⚠️ **本 RFC 最容易写错、也最关键的一处。**
> 现在 effect 里是 `setContent(live)`。**必须**改成逐字段回退，否则实时请求失败时会用 `null`
> 把烤进来的内容覆盖掉，G2 直接失效——修了半天等于没修：
>
> ```tsx
> setContent((prev) => ({
>   narrative: live.narrative ?? prev.narrative,
>   copy: live.copy ?? prev.copy,
>   editorial: live.editorial ?? prev.editorial,
> }))
> ```

**T3 — `src/app/layout.tsx` 改成 async 并注入**

```tsx
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const baked = await fetchBakedContent()
  return (
    ...
    <LiveContentProvider initial={baked}>
  )
}
```

**T4 — 用 `generateMetadata` 取代写死的 `metadata`**，让 `<title>` / `description` 也吃到后台值：

```tsx
export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await fetchBakedContent()
  const merged = mergeSiteCopy(SITE_COPY, copy)
  return { title: merged.site.title, description: merged.site.description, icons: { ... } }
}
```
`LiveDocumentMeta` 保留不动——它负责运行期实时更新标题，与烤入值不冲突。

**T5 — 量一下体积**。烤入的内容会进每个页面的 RSC payload（narrative 原始约 27KB）。记录改动前后 `out/` 的总大小与单页 HTML 大小，写进 PR 描述。若增幅不可接受，再讨论按页裁剪（本 RFC 不预先优化）。

## 6. 验收标准

逐条可验证，缺一不可：

1. **G1** — 构建产物的 HTML 里直接含后台文案：`grep -o '<后台改过的某句文案>' out/index.html` 出得来（今天出不来）
2. **G2** — 模拟接口返回 503（或断网）后加载页面，显示的是**烤入的后台文案**，不是 `narrative.ts` 的硬编码值
3. **N1 回归（最重要）** — 后台改一句文案，**不重新部署**，刷新前台 → 立刻看到新文案。这条挂了说明方案实现错了
4. 浏览器控制台无 hydration mismatch 警告
5. `CONTENT_BAKE_REQUIRED=1` 且接口不可达 → 构建失败并给出清晰错误
6. 不设 `CONTENT_BAKE_ORIGIN` → 构建成功，行为与今天一致（本地开发不受影响）
7. `npm run validate`、`npx tsc --noEmit`、`npm run lint` 全过

## 7. 风险

| 风险 | 缓解 |
|---|---|
| 构建期拉不到内容 → 静默发布成硬编码基线，等于回归 | `CONTENT_BAKE_REQUIRED=1` 让发布流水线**失败**而不是静默降级 |
| 每页 RSC payload 变大 | T5 先量；超预期再谈按页裁剪 |
| 忘了 T2 的逐字段回退 | 验收第 2 条专门卡这个 |
| 构建依赖线上站可达 | 只影响发布流水线；本地/CI 不设该变量，照常构建 |

## 8. 本 RFC 之后仍然存在的问题

**三个端点各自独立失败**，仍可能出现半新半旧的混合页面（narrative 挂了但 site-copy 成功）。根治要把 `/api/content/{narrative,site-copy,editorial}` 合并成单个端点，让覆盖原子化，顺带把每次加载的请求数降为三分之一。需同时改本仓与私有后台仓的接口契约，另开 RFC。
