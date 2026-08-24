'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BGM_OFF_KEY, BGM_VOLUME, nextTrack, pickTrack, type BgmTrack } from '@/lib/bgm'
import { trackSiteEvent } from '@/lib/site-analytics'

/**
 * 站内背景音乐。三条硬规则：
 *
 * 1. **离开就停**：切标签页、切到别的应用、锁屏——一律暂停，回来再续上。
 *    这是个视频索引站，用户点开外站视频后老标签页不该还在自己哼。
 * 2. **不主动花流量**：`preload="none"`，没真正开始播就一个字节都不下载。
 * 3. **关了就别再响**：用户手动关掉后写进 localStorage，之后翻页刷新都不再自动响。
 *
 * 浏览器不允许「带声音的自动播放」——首次进站的自动播放大概率被拦，
 * 因此先挂手势监听再尝试播放，用户第一次点/按/触屏时无缝补上。
 */
export function BgmPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [track, setTrack] = useState<BgmTrack | null>(null)
  const [playing, setPlaying] = useState(false)
  /** 「换一首」平时收着：桌面端 hover / 键盘 focus 时露出，触屏上点一下主键才露出 */
  const [revealed, setRevealed] = useState(false)
  const revealTimerRef = useRef<number | null>(null)
  /** 用户意愿：音乐「应该」是开着的吗（和实际有没有在响分开） */
  const wantsRef = useRef(false)
  const fadeRef = useRef<number | null>(null)
  /** 这次换曲是用户点「下一首」换的——换完要立刻接着放 */
  const skipRef = useRef(false)

  /** 淡入到目标音量：突然炸响比没有音乐更糟 */
  const fadeIn = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    if (fadeRef.current !== null) window.clearInterval(fadeRef.current)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.volume = BGM_VOLUME
      return
    }
    // 用定时器而不是 rAF：后台标签页里 rAF 会被完全冻住，
    // 音量就永远停在 0——「在播但没声音」比没淡入难查得多。
    const start = Date.now()
    const from = el.volume
    fadeRef.current = window.setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / 1200)
      el.volume = from + (BGM_VOLUME - from) * t
      if (t >= 1 && fadeRef.current !== null) {
        window.clearInterval(fadeRef.current)
        fadeRef.current = null
      }
    }, 40)
  }, [])

  /** 试着播放；被浏览器拦下时返回 false（交给调用方去等一个用户手势） */
  const tryPlay = useCallback(async () => {
    const el = audioRef.current
    if (!el) return false
    if (document.hidden) return false
    if (!el.paused) return true
    try {
      el.volume = 0
      await el.play()
      fadeIn()
      return true
    } catch {
      return false
    }
  }, [fadeIn])

  // 客户端决定曲目与用户意愿。真正的播放放到 track 挂载后的 effect，
  // 确保调用 play() 时 <audio> 已经存在。
  useEffect(() => {
    let off = false
    try {
      off = window.localStorage.getItem(BGM_OFF_KEY) === '1'
    } catch {
      off = false
    }
    const picked = pickTrack()
    // 曲目只能在客户端定（localStorage 在 SSR 读不到），一次性
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTrack(picked)
    if (off) return

    wantsRef.current = true
  }, [])

  // 先监听手势、再尝试自动播放：既不漏掉首屏的快速点击，也让 iOS 的
  // play() 直接发生在手势调用栈里。播放器自己的按钮由 click handler 处理，
  // 否则 pointerdown 播放成功后，紧接着的 click 会误把音乐再次关掉。
  useEffect(() => {
    if (!track || !wantsRef.current) return

    // pointerdown 在部分 Chromium 环境里早于 user activation 生效；click 是
    // 必要的第二道保障。touchend 则覆盖旧版 iOS Safari 的触摸激活时机。
    const gestures = ['pointerdown', 'click', 'keydown', 'touchend'] as const
    const onGesture = (event: Event) => {
      const el = audioRef.current
      if (!wantsRef.current || !el?.paused || document.hidden) return
      const target = event.target
      if (target instanceof Element && target.closest('[data-bgm-control]')) return
      void tryPlay()
    }

    gestures.forEach((eventName) => document.addEventListener(eventName, onGesture, { capture: true, passive: true }))
    void tryPlay()

    return () => {
      gestures.forEach((eventName) => document.removeEventListener(eventName, onGesture, true))
    }
  }, [track, tryPlay])

  // 离开这个界面就停：切标签页 / 切窗口 / 锁屏
  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const leave = () => {
      if (el.paused) return
      el.pause()
    }
    const back = () => {
      if (!wantsRef.current || document.hidden || !el.paused) return
      void tryPlay()
    }

    const onVisibility = () => (document.hidden ? leave() : back())
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', leave)
    window.addEventListener('focus', back)
    window.addEventListener('pagehide', leave)
    window.addEventListener('pageshow', back)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', leave)
      window.removeEventListener('focus', back)
      window.removeEventListener('pagehide', leave)
      window.removeEventListener('pageshow', back)
    }
  }, [track, tryPlay])

  useEffect(
    () => () => {
      if (fadeRef.current !== null) window.clearInterval(fadeRef.current)
      if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current)
    },
    [],
  )

  // 换了曲子就得重新 load()，否则 <source> 变了播放器还咬着旧文件
  useEffect(() => {
    if (!skipRef.current) return
    skipRef.current = false
    const el = audioRef.current
    if (!el) return
    el.load()
    void tryPlay()
  }, [track, tryPlay])

  /** 触屏没有 hover：点主键的同时把「换一首」顶出来，几秒没动静再收回去 */
  function revealForTouch() {
    if (window.matchMedia('(hover: hover)').matches) return
    setRevealed(true)
    if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current)
    revealTimerRef.current = window.setTimeout(() => setRevealed(false), 3500)
  }

  function skip() {
    if (!track) return
    skipRef.current = true
    wantsRef.current = true
    try {
      window.localStorage.removeItem(BGM_OFF_KEY)
    } catch {
      // 记不住不影响这次切歌
    }
    setTrack(nextTrack(track.id))
  }

  function toggle() {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      trackSiteEvent('media.play', 'audio')
      wantsRef.current = true
      try {
        window.localStorage.removeItem(BGM_OFF_KEY)
      } catch {
        // 存不下不影响这一次播放
      }
      void tryPlay()
    } else {
      trackSiteEvent('media.pause', 'audio')
      wantsRef.current = false
      el.pause()
      try {
        window.localStorage.setItem(BGM_OFF_KEY, '1')
      } catch {
        // 同上：这一次先停下，记不住就下次再说
      }
    }
  }

  if (!track) return null

  return (
    <>
      {/* preload="none"：不点开就不下载，省的是服务器的流量 */}
      <audio
        ref={audioRef}
        loop
        preload="none"
        playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        <source src={track.webm} type="audio/webm; codecs=opus" />
        <source src={track.m4a} type="audio/mp4; codecs=mp4a.40.2" />
      </audio>

      <div className="group fixed bottom-5 left-4 z-40 flex items-center overflow-hidden rounded-full border border-line/80 bg-surface/80 backdrop-blur sm:bottom-8 sm:left-[var(--page-gutter)]">
        <button
          type="button"
          data-bgm-control
          onClick={() => {
            revealForTouch()
            toggle()
          }}
          aria-pressed={playing}
          title={playing ? '背景音乐（点击暂停）' : '背景音乐已暂停（点击播放）'}
          className={`ui-press flex h-11 w-10 shrink-0 items-center justify-center rounded-full transition-[opacity,color] duration-300 hover:text-ink ${
            playing ? 'text-live opacity-70 hover:opacity-100' : 'text-faint opacity-45 hover:opacity-90'
          }`}
        >
          <span className="sr-only">{playing ? '暂停背景音乐' : '播放背景音乐'}</span>
          {/* 三根柱子：播放时跳动，暂停时压平成一条线 */}
          <span className={`bgm-bars ${playing ? 'is-playing' : ''}`} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </button>

        {/* 收起时宽度为 0：平时只看得到一个小圆钮，hover / focus / 触屏点击才伸出来 */}
        <span
          className={`flex items-center overflow-hidden transition-[width,opacity] duration-300 group-hover:w-11 group-hover:opacity-100 group-focus-within:w-11 group-focus-within:opacity-100 ${
            revealed ? 'w-11 opacity-100' : 'w-0 opacity-0'
          }`}
          style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
        >
          <span aria-hidden="true" className="h-4 w-px shrink-0 bg-line/80" />
          <button
            type="button"
            data-bgm-control
            onClick={() => {
              revealForTouch()
              skip()
            }}
            title="换一首"
            className="ui-press flex h-11 w-10 shrink-0 items-center justify-center text-faint opacity-60 transition-[opacity,color] duration-300 hover:text-ink hover:opacity-100"
          >
            <span className="sr-only">换一首背景音乐</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="stroke-current">
              <path d="M5 5l9 7-9 7V5z" strokeWidth="2" strokeLinejoin="round" />
              <path d="M19 5v14" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </span>
      </div>
    </>
  )
}
