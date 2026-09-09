/**
 * 落点高亮：跳过去之后给目标元素套一圈会自己退场的光晕。
 *
 * 原本长在 `TimelineRail` 里，只有右侧那条年月轨道用得上。现在节目详情页的
 * 「随机一期」也要落到同一种效果上——同一个页面上「跳到某一条」只该有一种表现，
 * 抄第二遍就会立刻分叉（时长不同、清理时机不同、两处同时亮着）。
 *
 * 状态放在模块级而不是组件里：这是一个作用在 document 上的效果，
 * 全页同一时刻只该有一个落点。谁后跳，谁把上一个摘掉。
 */

/** 落点类名，样式在 globals.css（封面版 / 列表行版各一套动画）。 */
export const LANDED_CLASS = 'timeline-rail-landed'
/** 高亮持续时长，必须与 globals.css 里两条动画的时长一致。 */
export const LANDED_MS = 3600
/** 目标还没渲染时（分批列表）等父级补批次，最多等这么久。 */
const LANDED_WAIT_MS = 3000
const LANDED_POLL_MS = 60

/**
 * 落点光需要同色的半透明版本。刻度色都是 6 位十六进制，直接补 alpha 位——
 * 用 color-mix() 写在 CSS 里更短，但它一旦不被支持，整条 box-shadow 声明都会作废，
 * 那就是「跳过去完全没有提示」，不是「提示淡一点」。
 */
function withAlpha(color: string, alpha: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : color
}

function clearAccent(element: HTMLElement) {
  element.style.removeProperty('--landed-accent')
  element.style.removeProperty('--landed-accent-soft')
  element.style.removeProperty('--landed-accent-wash')
}

let landed: { element: HTMLElement; timer: number } | null = null
let waitTimer = 0

/** 目标进 DOM 就点亮它；分批页面允许先等一会儿再点。 */
export function flashLandedTarget(id: string, color: string): void {
  if (typeof document === 'undefined') return
  if (waitTimer) window.clearTimeout(waitTimer)
  const deadline = Date.now() + LANDED_WAIT_MS
  const attempt = () => {
    waitTimer = 0
    const element = document.getElementById(id)
    if (!element) {
      if (Date.now() < deadline) waitTimer = window.setTimeout(attempt, LANDED_POLL_MS)
      return
    }
    if (landed) {
      window.clearTimeout(landed.timer)
      landed.element.classList.remove(LANDED_CLASS)
      clearAccent(landed.element)
    }
    element.style.setProperty('--landed-accent', color)
    element.style.setProperty('--landed-accent-soft', withAlpha(color, '8C'))
    element.style.setProperty('--landed-accent-wash', withAlpha(color, '24'))
    // 连点同一个目标也要再闪一次：先摘类、强制回流，动画才会从头播。
    element.classList.remove(LANDED_CLASS)
    void element.offsetWidth
    element.classList.add(LANDED_CLASS)
    landed = {
      element,
      timer: window.setTimeout(() => {
        element.classList.remove(LANDED_CLASS)
        clearAccent(element)
        landed = null
      }, LANDED_MS),
    }
  }
  attempt()
}

/** 离场时别把高亮和待办的等待留在页面上。 */
export function cancelLandedFlash(): void {
  if (typeof window === 'undefined') return
  if (waitTimer) window.clearTimeout(waitTimer)
  waitTimer = 0
  if (!landed) return
  window.clearTimeout(landed.timer)
  landed.element.classList.remove(LANDED_CLASS)
  clearAccent(landed.element)
  landed = null
}

/** 滚到目标，尊重「减少动态」偏好。目标不在 DOM 里时返回 false。 */
export function scrollToLandingTarget(id: string): boolean {
  if (typeof document === 'undefined') return false
  const target = document.getElementById(id)
  if (!target) return false
  target.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  })
  return true
}
