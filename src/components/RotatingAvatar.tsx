'use client'

import { useEffect, useState } from 'react'
import { AVATAR_STORAGE_KEY, AVATARS } from '@/lib/avatars'

export function RotatingAvatar() {
  const [avatar, setAvatar] = useState<(typeof AVATARS)[number]>(AVATARS[0])

  useEffect(() => {
    const saved = Number.parseInt(window.localStorage.getItem(AVATAR_STORAGE_KEY) ?? '', 10)
    const current = Number.isInteger(saved) && saved >= 0 && saved < AVATARS.length ? saved : -1
    const next = (current + 1) % AVATARS.length
    window.localStorage.setItem(AVATAR_STORAGE_KEY, String(next))
    setAvatar(AVATARS[next])
  }, [])

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={avatar.src} alt={avatar.alt} className="h-full w-full object-cover" />
  )
}
