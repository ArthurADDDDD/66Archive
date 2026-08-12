'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { ERAS } from '@/lib/covers'
import { proxyImage } from '@/lib/platforms'
import type { Highlight } from '@/lib/highlights'

/**
 * "有些晚上，到现在还记得"——六张手选的卡，一次看一张。
 *
 * 参考的是主机开机之后选游戏那个动作：**一排不多的东西，被选中的那个占住整个上半屏，
 * 其余的在下面排着等你走过去。** 借的只有这个动作，没有借任何一家的长相：
 * 没有磨砂玻璃、没有圆角方格选中放大、没有任何平台的图标语言（01-vision 第五节的红线）。
 *
 * 这六张是谁选的、为什么是这六个，全部写在 `src/lib/highlights.ts` 里——
 * 这个组件只管"怎么呈现"，不管"选哪些"。
 *
 * 三条不能动的：
 *
 * 1. **六张，不是六十张。** 少而且每张都说得出理由，才有"有人挑过"的感觉。
 * 2. **每张卡上必须有那句 why**，而且它锚定在真实数据上（entry / account / series 统计）。
 *    没有出处的话不该出现在这里。
 * 3. **不自动轮播。** 换哪一张永远由人决定。自动播放会把"选择"变回"播放列表"。
 */
export function MemoryShelf({ items }: { items: Highlight[] }) {
  const [active, setActive] = useState(0)
  const railRef = useRef<HTMLDivElement>(null)
  const current = items[active]
  if (!current) return null

  const era = ERAS.find((e) => e.id === current.eraId) ?? ERAS[0]
  const external = /^https?:\/\//.test(current.href)

  const onKeyDown = (e: React.KeyboardEvent) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = (active + delta + items.length) % items.length
    setActive(next)
    railRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <section>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center lg:gap-12">
        {/* key 让 Stage 跟着换卡整个重挂载，naturalWidth 算出来的上限才不会串到下一张。 */}
        <Stage key={current.id} item={current} color={era.color} />

        <div id={`moment-${current.id}`} role="tabpanel" aria-live="polite">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tnum">
            <span style={{ color: era.color }}>{current.dateLabel}</span>
            <span className="text-faint">{era.name}</span>
          </div>

          {/* 这句话是这张卡存在的理由，所以它排在标题前面、比标题更早被读到。 */}
          <p className="mt-4 text-[15px] leading-8 text-muted sm:text-[16px]">{current.why}</p>

          <Link
            href={current.href}
            {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
            className="ui-press mt-3 block rounded-sm text-[26px] font-medium leading-[1.45] text-ink underline-offset-[6px] hover:text-live hover:underline sm:text-[34px]"
          >
            {current.title}
            {external && <span className="ml-2 align-middle text-[16px] text-faint">↗</span>}
          </Link>
        </div>
      </div>

      {/* 下面这一排：其余五个在等着。 */}
      <div
        ref={railRef}
        role="tablist"
        aria-label="她的几件重要的事"
        onKeyDown={onKeyDown}
        className="mt-8 flex gap-2 overflow-x-auto pb-2 sm:gap-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, i) => {
          const selected = i === active
          const itemEra = ERAS.find((e) => e.id === item.eraId) ?? ERAS[0]
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={selected}
              aria-controls={`moment-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              className="ui-press group w-[104px] shrink-0 text-left sm:w-[132px]"
            >
              <span
                className="block h-[2px] w-full transition-colors"
                style={{ background: selected ? itemEra.color : 'transparent' }}
              />
              <span
                className="mt-1.5 flex aspect-video w-full items-center justify-center overflow-hidden bg-raised transition-opacity duration-200"
                style={{ opacity: selected ? 1 : 0.4 }}
              >
                {item.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={proxyImage(item.cover, 264) ?? ''}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="font-mono text-[9px] text-faint">{(item.bigText ?? item.title).slice(0, 6)}</span>
                )}
              </span>
              <span
                className="mt-1.5 block truncate font-mono text-[10px] tnum transition-colors"
                style={{ color: selected ? itemEra.color : undefined }}
              >
                {item.dateLabel}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/** 舞台向代理请求的宽度。也是"这张图到底有多大"的判据，见下面。 */
const STAGE_WIDTH = 960

/**
 * 舞台。
 *
 * 这里是全站"画质就是时间轴"这件事唯一被摆到明面上的地方，规矩有两条：
 *
 * 1. **一律不放大。** 图按自己的真实像素显示。2010 年那张封面原图只有 200×112，
 *    于是它在舞台上就是小小的一块，四周留黑；2026 年那张才铺满整个框。
 *    这正是 01-vision 第五节说的"宁可让 2010 年那张图小一点，也不要把它插值放大
 *    成假的清晰"——而且不做任何做旧滤镜，尺寸差本身就是十六年。
 * 2. **只在能确定的时候才报原图尺寸。** 我们向代理要 960 宽；
 *    回来的图如果**小于** 960，说明源图就这么大，那个尺寸是确定的，可以写出来；
 *    回来的图正好 960，只能说明源图 ≥ 960，具体多大不知道，那就什么都不写。
 *    宁可少说一句，也不写一个没核实的数——这条和数据侧的规矩是同一条。
 *
 * 尺寸是从 `naturalWidth` 现读的，不是查表：`src/lib/covers.ts` 里说过，
 * 按时期查表得到的分辨率是骗人的（A 站期内部就有 480 和 1920 两种稿件）。
 *
 * 少数几张卡（比如 156277 那张）没有封面——它们说的是一个账号、一个还在但已经
 * 没人打理的页面，不是一支具体的录像。这种时候舞台退化成一个纯色块 + 大字，
 * 不勉强配一张不属于它的截图。
 */
function Stage({ item, color }: { item: Highlight; color: string }) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  // 小于请求宽度 = 源图被"要完了"，这个尺寸才是确定的。
  const exhausted = natural !== null && natural.w < STAGE_WIDTH

  /*
   * 用 ref 回调而不是只挂 onLoad：首屏这张图是服务端渲染出来的，
   * 浏览器往往在 React 水合之前就把它加载完了，那次 load 事件我们根本收不到，
   * 尺寸标注会永远不出现。所以挂载时先查一次 `complete`。
   */
  const remember = (w: number, h: number) =>
    // 必须原样返回 prev，否则每次渲染都会拿到一个新对象 → 再触发一次渲染 → 死循环。
    setNatural((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }))

  const measure = (el: HTMLImageElement | null) => {
    if (el?.complete && el.naturalWidth) remember(el.naturalWidth, el.naturalHeight)
  }

  return (
    <div>
      <div className="flex h-[220px] items-center justify-center overflow-hidden bg-surface/40 sm:h-[300px] lg:h-[360px]">
        {item.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={measure}
            src={proxyImage(item.cover, STAGE_WIDTH) ?? ''}
            alt=""
            referrerPolicy="no-referrer"
            onLoad={(e) => remember(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
            // 只给上限，不给宽度：小图就停在自己的真实尺寸上，大图才铺满这个框。
            className={`ui-content-swap max-h-full max-w-full object-contain ${exhausted ? 'border border-line' : ''}`}
          />
        ) : (
          <span className="ui-content-swap px-4 text-center font-mono text-[40px] font-bold tnum sm:text-[56px]" style={{ color }}>
            {item.bigText ?? item.title}
          </span>
        )}
      </div>
      <p className="mt-2 h-4 font-mono text-[10px] text-faint tnum">
        {exhausted && natural && `原图 ${natural.w} × ${natural.h}`}
      </p>
    </div>
  )
}
