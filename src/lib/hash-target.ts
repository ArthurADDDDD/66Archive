/** 读取 URL 锚点；损坏的外链保留原值，避免解码异常中断页面初始化。 */
export function decodeHashTarget(hash: string): string {
  const target = hash.startsWith('#') ? hash.slice(1) : hash
  try {
    return decodeURIComponent(target)
  } catch {
    return target
  }
}
