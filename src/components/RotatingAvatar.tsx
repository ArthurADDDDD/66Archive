'use client'

import { useEffect, useState } from 'react'
import { AVATAR_STORAGE_KEY, AVATARS } from '@/lib/avatars'
import { proxyImage } from '@/lib/platforms'

/** 存储被禁时按「没存过」处理（返回 -1），下一张就从第一张开始。 */
function readStoredAvatarIndex(): number {
  try {
    const saved = Number.parseInt(window.localStorage.getItem(AVATAR_STORAGE_KEY) ?? '', 10)
    return Number.isInteger(saved) && saved >= 0 && saved < AVATARS.length ? saved : -1
  } catch {
    return -1
  }
}

/** 存不下就算了：轮换在本次会话里照常可用，只是下次访问不接着上次。 */
function writeStoredAvatarIndex(index: number) {
  try {
    window.localStorage.setItem(AVATAR_STORAGE_KEY, String(index))
  } catch {
    // 隐私模式 / 禁用站点数据，忽略。
  }
}

export function RotatingAvatar() {
  const [avatarIndex, setAvatarIndex] = useState(0)

  useEffect(() => {
    // 浏览器设成「阻止所有网站数据」时，连访问 window.localStorage 这个属性都会抛
    // SecurityError。这个 effect 挂在首页上，抛出去会被全局错误边界接住、把整个首页
    // 换成一句英文报错——为了一个换头像的小彩蛋，代价完全不成比例。
    const next = (readStoredAvatarIndex() + 1) % AVATARS.length
    writeStoredAvatarIndex(next)
    // 头像轮换只能客户端做（localStorage 在 SSR 不可读），一次性且无外部依赖
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAvatarIndex(next)
  }, [])

  const avatar = AVATARS[avatarIndex]
  const src = avatar.src.startsWith('/') ? avatar.src : (proxyImage(avatar.src, 640) ?? avatar.src)

  function showNextAvatar() {
    const next = (avatarIndex + 1) % AVATARS.length
    writeStoredAvatarIndex(next)
    setAvatarIndex(next)
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={avatar.src}
      src={src}
      alt={avatar.alt}
      title={`${avatar.alt} · 点击查看下一时期`}
      className="ui-avatar-in h-full w-full cursor-pointer object-cover"
      onClick={showNextAvatar}
    />
  )
}
