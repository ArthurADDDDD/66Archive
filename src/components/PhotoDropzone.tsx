'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PreparedPhoto } from '@/lib/photo-submit'

/**
 * 投稿图片的拖拽区。
 *
 * ## 三种加图方式，一个都不能少
 *
 * - **拖进来**：桌面上最自然，可以一次拖多张
 * - **点一下选**：手机上拖拽没有意义，这仍然是主路径；桌面上也有人习惯这个
 * - **粘贴**：「我存着老图」最常见的来源就是截图。截完图直接 Ctrl/⌘+V，
 *   比先存盘再来选文件少两步
 *
 * 所以整块区域既是放置目标、又是按钮，同时在面板可见时监听 paste。
 *
 * ## 为什么用 dragenter/dragleave 计数
 *
 * 指针从子元素移到另一个子元素时，浏览器会先发一个 dragleave 再发 dragenter。
 * 只看这两个事件的话，鼠标在区域里正常移动就会让高亮不停闪。计数之后只有
 * 真正离开整块区域才归零。
 *
 * ## 缩略图的 object URL 必须回收
 *
 * `URL.createObjectURL` 建的引用在页面卸载前不会自己释放，附几张大图再删掉，
 * 那些 blob 会一直占着内存。所以这里按当前列表重建 URL 并在依赖变化时逐个
 * revoke——不是在删除的回调里 revoke，那样漏掉「整个表单被成功态替换」的情况。
 */

export function PhotoDropzone({
  photos,
  onAdd,
  onRemove,
  preparing,
  max,
  remaining,
}: {
  photos: PreparedPhoto[]
  /** 交原始 File[] 出去，压缩与体积校验由调用方统一做。 */
  onAdd: (files: File[]) => void
  onRemove: (index: number) => void
  preparing: boolean
  max: number
  remaining: number
}) {
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  /*
   * 用 useMemo 建、用 effect 的清理函数回收，而不是 effect 里 setState——
   * 后者会被 `react-hooks/set-state-in-effect` 拦下（本仓把它设成 error），
   * 而且多一次渲染。清理在 previews 变化时和卸载时各跑一次，正好覆盖
   * 「删掉一张」和「整个表单被成功态替换」两种情况。
   */
  const previews = useMemo(() => photos.map((photo) => URL.createObjectURL(photo.file)), [photos])
  useEffect(
    () => () => {
      for (const url of previews) URL.revokeObjectURL(url)
    },
    [previews],
  )

  const takeFiles = useCallback(
    (list: FileList | File[] | null) => {
      if (!list) return
      const images = [...list].filter((file) => file.type.startsWith('image/'))
      if (images.length > 0) onAdd(images)
    },
    [onAdd],
  )

  // 粘贴。挂在 document 上而不是这一块上：截完图直接按 Ctrl+V 的人，
  // 焦点多半不在这个区域里。
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = [...(event.clipboardData?.files ?? [])]
      if (files.length === 0) return
      // 在输入框里粘贴文字不该被当成加图；只有真的带文件时才拦。
      event.preventDefault()
      takeFiles(files)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [takeFiles])

  const full = remaining <= 0

  return (
    <div>
      <div
        ref={rootRef}
        onDragEnter={(event) => {
          event.preventDefault()
          dragDepth.current += 1
          setDragging(true)
        }}
        onDragOver={(event) => {
          // 不 preventDefault 的话浏览器会拒绝 drop，整块区域看起来「不接受」。
          event.preventDefault()
        }}
        onDragLeave={() => {
          dragDepth.current -= 1
          if (dragDepth.current <= 0) {
            dragDepth.current = 0
            setDragging(false)
          }
        }}
        onDrop={(event) => {
          event.preventDefault()
          dragDepth.current = 0
          setDragging(false)
          // 满了也要走 takeFiles：调用方那边会算「还剩几个位子」并给出
          // 「超出的 N 张没加进来」。直接 return 的话拖第四张是**静默无反应**，
          // 用户只会以为是拖拽没生效，再试一次，还是没反应。
          takeFiles(event.dataTransfer.files)
        }}
        className={`rounded-xl border border-dashed px-5 py-6 text-center transition-colors ${
          dragging ? 'border-live bg-live/10' : full ? 'border-line/70 bg-base/20' : 'border-line bg-base/30'
        }`}
      >
        {full ? (
          <p className="text-control text-faint">已经挑满 {max} 张了</p>
        ) : (
          <>
            <p className="text-control text-muted">
              把图片拖到这里
              <span className="mx-1.5 text-faint">·</span>
              或者
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="ui-press mx-1 rounded-sm text-live underline decoration-live/40 underline-offset-4 hover:decoration-live"
              >
                选择文件
              </button>
              <span className="mx-1.5 text-faint">·</span>
              截图后直接粘贴也行
            </p>
            <p className="mt-1.5 text-meta text-faint">
              还能再加 {remaining} 张（一共最多 {max} 张）
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(event) => {
            const chosen = event.target.files
            // 同一个文件再选一次时 value 不变、onChange 不触发；清空才能重选。
            takeFiles(chosen)
            event.target.value = ''
          }}
        />
      </div>

      {preparing && <p className="mt-2 text-meta text-faint">正在压缩…</p>}

      {photos.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo, index) => (
            <li key={`${photo.file.name}-${index}`} className="group relative overflow-hidden rounded-lg border border-line bg-base/40">
              {/* eslint-disable-next-line @next/next/no-img-element -- 本地 object URL，不走图片优化 */}
              <img
                src={previews[index]}
                alt={photo.file.name}
                className="aspect-[4/3] w-full object-cover"
              />
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label={`移除 ${photo.file.name}`}
                className="ui-press absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/65 text-meta text-white backdrop-blur hover:bg-black/85"
              >
                ✕
              </button>
              <p className="truncate px-2 py-1.5 text-meta text-faint tnum">
                {(photo.file.size / 1024).toFixed(0)} KB
                {photo.originalBytes > photo.file.size && (
                  <span className="ml-1">· 已压缩</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
