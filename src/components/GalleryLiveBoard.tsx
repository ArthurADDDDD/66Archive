'use client'

import { useEffect, useState } from 'react'
import type { GalleryPhoto } from '@/lib/gallery-photos'
import { fetchGalleryAdditions, mergeGalleryPhotos } from '@/lib/gallery-additions'
import { GalleryBoard } from './GalleryBoard'

/**
 * 画廊的运行时增量层。
 *
 * 站点是静态导出，`allPhotos` 是构建期烤进 HTML 的那一份。新收进来、还没写进公开仓的
 * 照片由内容服务在运行时补上——这样「整理完立刻看看排出来什么样」不用等一次部署。
 *
 * 为什么单独包一层而不是改 GalleryBoard：GalleryBoard 只关心「给我一批照片，我来排版
 * 和交互」，它不该知道照片有两个来源。把取数放在外面，GalleryBoard 在没有内容服务的
 * 环境里（比如离线构建、组件测试）行为完全不变。
 *
 * 首屏渲染的永远是构建期那一份，增量随后打上去——这也正是「内容服务挂了页面照常」的
 * 实现方式：拉取失败就什么都不发生。
 */
export function GalleryLiveBoard({
  featuredPhotos,
  allPhotos,
}: {
  featuredPhotos: GalleryPhoto[]
  allPhotos: GalleryPhoto[]
}) {
  const [photos, setPhotos] = useState(allPhotos)

  useEffect(() => {
    let active = true
    void fetchGalleryAdditions().then((additions) => {
      // 组件已卸载，或者根本没有增量——两种情况都不该触发一次重渲染
      if (!active || additions.length === 0) return
      setPhotos((current) => mergeGalleryPhotos(current, additions))
    })
    return () => {
      active = false
    }
  }, [])

  // 精选是人工挑的策展顺序，新上传的照片没有被挑进去，所以只并进「全量」那一栏。
  return <GalleryBoard featuredPhotos={featuredPhotos} allPhotos={photos} />
}
