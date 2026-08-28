'use client'

import { useEffect, useState } from 'react'
import { AVATAR_STORAGE_KEY, AVATARS } from '@/lib/avatars'
import { proxyImage } from '@/lib/platforms'

export function RotatingAvatar() {
  const [avatarIndex, setAvatarIndex] = useState(0)

  useEffect(() => {
    const saved = Number.parseInt(window.localStorage.getItem(AVATAR_STORAGE_KEY) ?? '', 10)
    const current = Number.isInteger(saved) && saved >= 0 && saved < AVATARS.length ? saved : -1
    const next = (current + 1) % AVATARS.length
    window.localStorage.setItem(AVATAR_STORAGE_KEY, String(next))
    // 头像轮换只能客户端做（localStorage 在 SSR 不可读），一次性且无外部依赖
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAvatarIndex(next)
  }, [])

  const avatar = AVATARS[avatarIndex]
  const src = avatar.src.startsWith('/') ? avatar.src : (proxyImage(avatar.src, 640) ?? avatar.src)

  function showNextAvatar() {
    const next = (avatarIndex + 1) % AVATARS.length
    window.localStorage.setItem(AVATAR_STORAGE_KEY, String(next))
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
