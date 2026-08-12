/**
 * 素材报告里保存的是平台 + 稳定 ID，而不是把外链重复写进展示数据。
 * 只有能从稳定 ID 明确还原的平台才生成跳转，未知格式继续只显示文字。
 * 纯函数模块（无 node 依赖）——客户端组件也要用。
 */
export function gallerySourceHref(source: string): string | null {
  const explicit = source.match(/https?:\/\/[^\s)]+/i)?.[0]
  if (explicit) return explicit.replace(/[。，、；;]+$/, '')

  const bvid = source.match(/\bBV[0-9A-Za-z]+\b/i)?.[0]
  if (bvid) return `https://www.bilibili.com/video/${bvid}`

  const youkuId = source.match(/\bX[A-Za-z0-9_-]+={0,2}/)?.[0]
  if (youkuId) return `https://v.youku.com/v_show/id_${youkuId}.html`

  return null
}
