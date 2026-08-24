/**
 * 站内背景音乐清单。
 *
 * 两种编码各存一份：Chrome / Firefox / Edge / Android 取 WebM(Opus)，
 * Safari / iOS 回落到 M4A(AAC)——每个访客只会下载其中一个。
 * 曲名未经确认，先留编号，不编造。
 */
export type BgmTrack = {
  id: string
  /** 控件上的可读名称（无障碍标签用） */
  label: string
  webm: string
  m4a: string
}

export const BGM_TRACKS: BgmTrack[] = [
  { id: '01', label: '曲目 01', webm: '/audio/bgm-01.webm', m4a: '/audio/bgm-01.m4a' },
  { id: '02', label: '曲目 02', webm: '/audio/bgm-02.webm', m4a: '/audio/bgm-02.m4a' },
  { id: '03', label: '曲目 03', webm: '/audio/bgm-03.webm', m4a: '/audio/bgm-03.m4a' },
]

/** 第一次进站的标记：没有它就一定放 01，和首页头像「第一次一定是 2015」同一个套路 */
export const BGM_VISITED_KEY = 'chronicle-66-bgm-visited'
/** 上一次放的是哪一首——用来避免刷新后又抽到同一首 */
export const BGM_LAST_KEY = 'chronicle-66-bgm-last'
/**
 * 背景音就该是背景：压低音量，别盖过用户自己在放的东西。
 * 0.6 是「听得见但不吓人」的位置——自动播放不给用户预警，满音量炸出来最劝退。
 */
export const BGM_VOLUME = 0.6

/**
 * 本次页面加载已经定下的曲子。React 严格模式会把副作用跑两遍，
 * 没有这道闸的话「第一次进站放 01」会被第二遍立刻改写成随机曲。
 */
let chosenThisLoad: BgmTrack | null = null

/**
 * 选这次要放的曲子：第一次进站固定 01，之后随机且不重复上一首。
 * 只能在客户端调用（读 localStorage）。同一次页面加载内结果稳定。
 */
export function pickTrack(): BgmTrack {
  if (chosenThisLoad) return chosenThisLoad
  let visited: string | null = null
  let last: string | null = null
  try {
    visited = window.localStorage.getItem(BGM_VISITED_KEY)
    last = window.localStorage.getItem(BGM_LAST_KEY)
  } catch {
    // 隐私模式下 localStorage 会抛错——当作第一次进站，放 01
  }

  const track = !visited
    ? BGM_TRACKS[0]
    : (() => {
        const others = BGM_TRACKS.filter((t) => t.id !== last)
        const pool = others.length > 0 ? others : BGM_TRACKS
        return pool[Math.floor(Math.random() * pool.length)]
      })()

  try {
    window.localStorage.setItem(BGM_VISITED_KEY, '1')
    window.localStorage.setItem(BGM_LAST_KEY, track.id)
  } catch {
    // 存不下就存不下，下次当第一次处理
  }
  chosenThisLoad = track
  return track
}

/**
 * 手动切歌：随机换成另一首（一定不是当前这首），并记为「上一次放的」。
 * 不是每个人都会刷新页面，所以换歌得有个手动入口。
 */
export function nextTrack(currentId: string): BgmTrack {
  const others = BGM_TRACKS.filter((t) => t.id !== currentId)
  const pool = others.length > 0 ? others : BGM_TRACKS
  const track = pool[Math.floor(Math.random() * pool.length)]
  try {
    window.localStorage.setItem(BGM_LAST_KEY, track.id)
  } catch {
    // 记不住就算了，不影响这次切歌
  }
  chosenThisLoad = track
  return track
}
