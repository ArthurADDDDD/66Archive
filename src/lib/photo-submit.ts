'use client'

/**
 * 投稿图片：浏览器端先压一遍，再作为 multipart 提交。
 *
 * ## 浏览器端压缩不是安全措施
 *
 * 它省的是流量和服务器 CPU——手机直出动辄 4MB，压到 2000px 之后通常只剩几百 KB，
 * 在国内移动网络上是几秒和几十秒的差别。但客户端跑的任何东西都不可信：
 * 服务端照样会用 sharp 全量重编码，那一步才是安全边界。
 * 所以这里压不动、或者浏览器不支持，直接把原文件交上去就好，不要因此挡住提交。
 *
 * ## 为什么不用 OffscreenCanvas / WebP
 *
 * 目标是「在尽可能多的手机上能用」，不是压到最小。`createImageBitmap` + `<canvas>`
 * + `toBlob('image/jpeg')` 是覆盖面最广的一组；WebP 编码在一些旧 iOS Safari 上
 * 会静默产出 PNG，反而更大。
 */

/** 与服务端 MAX_INBOX_BYTES 对齐。超过就不提交，早说比传半天再失败好。 */
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024
export const MAX_PHOTOS = 3

/** 长边上限。服务端收下后也会压到 2000，这里先压掉的是上行流量。 */
const TARGET_EDGE = 2000
const TARGET_QUALITY = 0.85

export type PreparedPhoto = {
  file: File
  /** 原始体积，用来在界面上说明「已经帮你压过」 */
  originalBytes: number
}

async function downscale(file: File): Promise<File | null> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return null
  }
  try {
    const scale = Math.min(1, TARGET_EDGE / Math.max(bitmap.width, bitmap.height))
    // 已经够小就别再编码一遍：重编码只会掉画质，换不回多少体积。
    if (scale === 1 && file.size <= 1_500_000) return null

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', TARGET_QUALITY))
    if (!blob || blob.size >= file.size) return null
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return null
  } finally {
    bitmap.close()
  }
}

/**
 * `slots` 是「还能再加几张」，不是整批上限——调用方可能已经挑了两张再拖进来三张。
 * 用 MAX_PHOTOS 截断的话，那三张会先被截成三张、再在调用方那边被静默丢掉两张，
 * 用户看到的是「我拖了三张，只进来一张」，而且没有任何解释。
 */
export async function preparePhotos(
  files: File[],
  slots: number = MAX_PHOTOS,
): Promise<{ prepared: PreparedPhoto[]; rejected: string[] }> {
  const prepared: PreparedPhoto[] = []
  const rejected: string[] = []
  if (files.length > slots) {
    rejected.push(`超出的 ${files.length - slots} 张没加进来（一次最多 ${MAX_PHOTOS} 张）`)
  }
  for (const file of files.slice(0, Math.max(0, slots))) {
    const smaller = (await downscale(file)) ?? file
    if (smaller.size > MAX_PHOTO_BYTES) {
      rejected.push(`${file.name}（${(smaller.size / 1024 / 1024).toFixed(1)}MB，超过 ${MAX_PHOTO_BYTES / 1024 / 1024}MB）`)
      continue
    }
    prepared.push({ file: smaller, originalBytes: file.size })
  }
  return { prepared, rejected }
}

/** 带图提交。走 `/api/correction/photo`（multipart），一个 Turnstile 令牌一次提交。 */
export async function submitWithPhotos(input: {
  reporterName: string
  body: string
  turnstileToken: string
  photos: File[]
}): Promise<void> {
  const form = new FormData()
  form.set('reporterName', input.reporterName)
  form.set('body', input.body)
  form.set('kind', 'correction')
  form.set('turnstileToken', input.turnstileToken)
  for (const photo of input.photos) form.append('photo', photo)

  const response = await fetch('/api/correction/photo', { method: 'POST', body: form, credentials: 'omit' })
  if (response.ok) return

  // 网关与 CDN 的错误不是 JSON，读 body 会拿到一段 HTML。按状态码给话，别把 HTML 抛给用户。
  if (response.status === 413) throw new Error('图片太大了，换张小一点的再试')
  if (response.status === 429) throw new Error('上传太频繁了，过一会儿再来')
  /*
   * 站点前面是 EdgeOne，它会用自己的 5xx 码回绝（实测过 554）。这**不是体积门槛**：
   * 同一轮里 9MB 拿到 554 而 20MB 正常穿过去了，所以它是传输中的瞬时失败。
   * 对用户而言唯一有用的信息是「再试一次通常就好」，不是那个数字。
   */
  if (response.status >= 500) throw new Error('上传中断了，再试一次通常就好')
  let message = '提交失败，请稍后再试'
  try {
    const body = (await response.json()) as { message?: string }
    if (typeof body.message === 'string' && body.message) message = body.message
  } catch {
    // 不是 JSON 就用上面那句兜底。
  }
  throw new Error(message)
}
