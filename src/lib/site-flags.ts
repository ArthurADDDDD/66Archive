/**
 * 站点级开关：这里的值是构建期常量，改完要走一次正常的发布（合并 → release-web → 部署）才生效。
 *
 * ## SHOW_REPO_LINK
 *
 * 联系页有一张指向公开仓库的卡片。想暂时不让更多人知道这个项目开源时，把它改成 `false`：
 * 卡片整张不渲染，仓库地址不会出现在页面里；对应的三句页面文字（`contact-repo-*`）
 * 也不再随页面烤进 HTML。
 *
 * 只管这个站点本身的展示。仓库在 GitHub 上是否公开、README 与提交记录里写了什么，
 * 不在这个开关的范围内——要真正藏起来，还得把仓库本身设为私有（那会让 CI 与发布链路
 * 的公开读取假设一起失效，动之前先读 docs/web-release-identity.md）。
 */
export const SHOW_REPO_LINK = true

export const REPO_URL = 'https://github.com/ArthurADDDDD/66archive'

/** 隐藏仓库卡片时，这些页面文字不该出现在这一页烤入的文案里。 */
export const REPO_TEXT_PREFIX = 'contact-repo-'
