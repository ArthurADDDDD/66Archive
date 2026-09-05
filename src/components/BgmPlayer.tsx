'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BGM_OFF_KEY, BGM_VOLUME, nextTrack, pickTrack, type BgmTrack } from '@/lib/bgm'
import { trackSiteEvent } from '@/lib/site-analytics'

/**
 * 站内背景音乐。三条硬规则：
 *
 * 1. **离开就停**：切标签页、切到别的应用、锁屏——一律暂停，回来再续上。
 *    这是个视频索引站，用户点开外站视频后老标签页不该还在自己哼。
 * 2. **交互前不碰音频网络**：`preload="none"`，首次正常用户手势到来后才起播。
 * 3. **关了就别再响**：用户手动暂停后写进 localStorage；同一设备之后翻页、刷新都保持暂停，
 *    直到用户再次手动播放或换一首。
 *
 * 浏览器不允许「带声音的自动播放」——首次进站的自动播放大概率被拦，
 * 因此先挂手势监听再尝试播放，用户第一次点/按/触屏时无缝补上。
 */
export function BgmPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [track, setTrack] = useState<BgmTrack | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  /** 「换一首」平时收着：桌面端 hover / 键盘 focus 时露出，触屏上点一下主键才露出 */
  const [revealed, setRevealed] = useState(false)
  const revealTimerRef = useRef<number | null>(null)
  /** 用户意愿：音乐「应该」是开着的吗（和实际有没有在响分开） */
  const wantsRef = useRef(false)
  /** 只有真正收到过用户手势，回到页面时才允许自动续播。 */
  const activatedRef = useRef(false)
  /** 「换一首」会更换 <source>，等 DOM 更新后再起播新曲。 */
  const playAfterTrackChangeRef = useRef(false)
  const fadeRef = useRef<number | null>(null)
  /** 同一时刻只留一个 play() promise；慢网下连点不会叠出多轮起播请求。 */
  const playAttemptRef = useRef<Promise<boolean> | null>(null)

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
  const tryPlay = useCallback((): Promise<boolean> => {
    const el = audioRef.current
    if (!el || document.hidden) return Promise.resolve(false)
    if (!el.paused) return Promise.resolve(true)
    if (playAttemptRef.current) return playAttemptRef.current

    const attempt = (async () => {
      setLoading(true)
      try {
        el.volume = 0
        await el.play()
        fadeIn()
        return true
      } catch {
        return false
      } finally {
        playAttemptRef.current = null
        setLoading(false)
      }
    })()
    playAttemptRef.current = attempt
    return attempt
  }, [fadeIn])

  // 客户端决定曲目与用户意愿；这里不发起任何媒体请求。
  useEffect(() => {
    const picked = pickTrack()
    // 曲目只能在客户端定（localStorage 在 SSR 读不到），一次性
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTrack(picked)

    let off = false
    try {
      off = window.localStorage.getItem(BGM_OFF_KEY) === '1'
    } catch {
      // 隐私模式下记不住暂停偏好；这次仍按默认自动播放处理。
    }
    wantsRef.current = !off
  }, [])

  // 监听首次正常手势，让 iOS 的 play() 直接发生在手势调用栈里。
  // 播放器自己的按钮由 click handler 处理，
  // 否则 pointerdown 播放成功后，紧接着的 click 会误把音乐再次关掉。
  useEffect(() => {
    if (!track || !wantsRef.current) return

    // 页面已经完成一次真实交互、但监听器因 hydration 较慢还没来得及挂上时，
    // userActivation 会替我们记住它。此分支仍严格发生在交互之后，不会提前请求音频。
    if (navigator.userActivation?.hasBeenActive) {
      activatedRef.current = true
      void tryPlay()
    }

    // pointerdown 在部分 Chromium 环境里早于 user activation 生效；click 是
    // 必要的第二道保障。touchend 则覆盖旧版 iOS Safari 的触摸激活时机。
    // wheel / scroll 不是激活手势，不应触发音频请求。
    const gestures = ['pointerdown', 'click', 'keydown', 'touchend'] as const
    const onGesture = (event: Event) => {
      const el = audioRef.current
      if (!wantsRef.current || !el?.paused || document.hidden) return
      const target = event.target
      if (target instanceof Element && target.closest('[data-bgm-control]')) return
      activatedRef.current = true
      void tryPlay()
    }

    gestures.forEach((eventName) => document.addEventListener(eventName, onGesture, { capture: true, passive: true }))

    return () => {
      gestures.forEach((eventName) => document.removeEventListener(eventName, onGesture, true))
    }
  }, [track, tryPlay])

  // 换曲是明确用户手势，可以在新 <source> 挂载后立即加载并续播；
  // 首次挑选曲目时这个标记为 false，因此不会偷跑媒体请求。
  useEffect(() => {
    if (!track || !playAfterTrackChangeRef.current) return
    playAfterTrackChangeRef.current = false
    const el = audioRef.current
    if (!el || !wantsRef.current || document.hidden) return
    el.load()
    void tryPlay()
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
      if (!activatedRef.current || !wantsRef.current || document.hidden || !el.paused) return
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

  /** 触屏没有 hover：点主键的同时把「换一首」顶出来，几秒没动静再收回去 */
  function revealForTouch() {
    if (window.matchMedia('(hover: hover)').matches) return
    setRevealed(true)
    if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current)
    revealTimerRef.current = window.setTimeout(() => setRevealed(false), 3500)
  }

  function skip() {
    if (!track) return
    activatedRef.current = true
    wantsRef.current = true
    playAfterTrackChangeRef.current = true
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
      activatedRef.current = true
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
        // 这一次先停下；记不住就只影响这次浏览。
      }
    }
  }

  if (!track) return null

  return (
    <>
      {/* 等首次真实手势才让 play() 启动媒体请求。 */}
      <audio
        ref={audioRef}
        loop
        preload="none"
        playsInline
        onPlaying={() => {
          setLoading(false)
          setPlaying(true)
        }}
        onWaiting={() => {
          if (wantsRef.current) setLoading(true)
        }}
        onPause={() => {
          setLoading(false)
          setPlaying(false)
        }}
      >
        <source src={track.webm} type="audio/webm; codecs=opus" />
        <source src={track.m4a} type="audio/mp4; codecs=mp4a.40.2" />
      </audio>

      <div className="group fixed bottom-5 left-4 z-40 flex items-center overflow-hidden rounded-full border border-line/70 bg-surface/70 opacity-45 backdrop-blur transition-opacity hover:opacity-100 focus-within:opacity-100 sm:bottom-8 sm:left-8">
        <button
          type="button"
          data-bgm-control
          onClick={() => {
            revealForTouch()
            toggle()
          }}
          aria-pressed={playing}
          aria-busy={loading}
          title={loading ? '正在加载背景音乐' : playing ? '背景音乐（点击暂停）' : '背景音乐已暂停（点击播放）'}
          className={`ui-press flex h-11 w-10 shrink-0 items-center justify-center rounded-full transition-[opacity,color] duration-300 hover:text-ink ${
            playing || loading ? 'text-live opacity-70 hover:opacity-100' : 'text-faint opacity-45 hover:opacity-90'
          }`}
        >
          <span className="sr-only">{loading ? '正在加载背景音乐' : playing ? '暂停背景音乐' : '播放背景音乐'}</span>
          {/* 三根柱子：播放时跳动，暂停时压平成一条线 */}
          <span className={`bgm-bars ${playing ? 'is-playing' : ''} ${loading ? 'animate-pulse' : ''}`} aria-hidden="true">
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
