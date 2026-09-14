/**
 * 素材报告里保存的是平台 + 稳定 ID，而不是把外链重复写进展示数据。
 * 只有能从稳定 ID 明确还原的平台才生成跳转，未知格式继续只显示文字。
 * 纯函数模块（无 node 依赖）——客户端组件也要用。
 */
export function gallerySourceHref(source: string): string | null {
  // 只吃可见 ASCII 字符：画6大赛这批 source 是「URL 紧跟中文全角括号说明」，
  // 中间没有空格，旧写法 `[^\s)]+` 遇到全角「）」不算结束符，会把后面整段
  // 中文说明文字一起吞进 href，点出去变成一串乱码地址。
  const explicit = source.match(/https?:\/\/[\x21-\x7e]+/i)?.[0]
  if (explicit) return explicit.replace(/[.,;:!?)\]}'"]+$/, '')

  const bvid = source.match(/\bBV[0-9A-Za-z]+\b/i)?.[0]
  if (bvid) return `https://www.bilibili.com/video/${bvid}`

  const youkuId = source.match(/\bX[A-Za-z0-9_-]+={0,2}/)?.[0]
  if (youkuId) return `https://v.youku.com/v_show/id_${youkuId}.html`

  return null
}
