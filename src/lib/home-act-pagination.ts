/**
 * 首页桌面端故事卡与右侧时间轴之间的轻量事件契约。
 *
 * 两个组件是页面上的兄弟节点；用 DOM 事件连接可以避免为了这一处交互
 * 把整张首页再包一层 client provider。事件只存在于浏览器内，不承载数据。
 */
export const HOME_ACT_SELECT_EVENT = 'home-act:select'
export const HOME_ACT_CHANGE_EVENT = 'home-act:change'

export type HomeActSelectDetail = { id: string }
export type HomeActChangeDetail = { id: string; active: boolean }
