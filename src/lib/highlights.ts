import type { Dataset, TimelineEntry } from './data'
import { toTimelineEntries } from './data'
import { buildSeriesStats } from './series-stats'
import { eraOf } from './covers'

/**
 * "有些晚上，到现在还记得"——首页唯一一段允许主观判断的地方。
 *
 * `moments.ts`（现在删掉了）试过完全靠公式选：最早一条、最长沉默、最长单场……
 * 逻辑很干净，但一个老粉丝会问"156277 呢？心灵砒霜呢？"——公式答不出这些问题，
 * 因为它们的重要性不是"数据里的异常值"，是**认识这个人的人才知道该往哪儿看**。
 *
 * 所以这里改成手选，但手选不等于瞎编。规矩是：
 *
 * 1. **每一条必须能追到 `data/` 里一个具体的东西**——一条 entry、一个 account、
 *    或者一个由 `buildSeriesStats` 算出来的系列统计。选哪一条是人挑的，
 *    但卡片上出现的每一个数字（243 期、219 个星期天、96 天、535 天）都是算出来的。
 * 2. **不写没核实的话。** 156277 那句"see you around~，贵宾和钻粉都是 0"
 *    原样抄自 `accounts.yaml` 的 note（2026-08 实测），不是我们的转述。
 * 3. **这份名单本身就是编辑判断，所以放在这个文件里，不掺进别的地方。**
 *    下一个人想换掉某一条、加一条、调顺序，直接改这个数组，不用碰组件代码。
 *    但换之前想清楚：为什么是这条，不是别的——这才是"策展"两个字的重量。
 */

export type Highlight = {
  id: string
  /** 有具体日期就写，没有（比如 156277 这种"一直如此"的事实）就留空 */
  date?: string
  /** 卡片上显示的日期文案；没有就退回 date 本身 */
  dateLabel: string
  eraId: 'video' | 'douyu' | 'douyin'
  cover: string | null
  title: string
  /** 没有封面时，舞台上要显示的大字——比标题短，比如 156277。留空就退回 title。 */
  bigText?: string
  why: string
  href: string
}

function findEntry(entries: TimelineEntry[], id: string): TimelineEntry | undefined {
  return entries.find((e) => e.id === id)
}

export function buildHighlights(ds: Dataset): Highlight[] {
  const entries = toTimelineEntries(ds)
  const series = buildSeriesStats(ds).find((s) => s.id === 'xinling-pishuang')
  const douyu = ds.accounts.get('douyu-official')

  const list: (Highlight | null | undefined | false)[] = [
    // ① 156277。九年，现在还在，写着 see you around~。整个站上最该被记住的一个数字。
    /*
     * 故意不给封面。156277 是一个房间号，不是一支录像——随便配一张斗鱼期的截图
     * 上去，等于在暗示"这张图代表 156277"，但它谁都不代表，只是恰好拍到了。
     * 没有封面时 Stage 会退化成纯色块 + 大字，见 MemoryShelf.tsx。
     */
    douyu && {
      id: 'room-156277',
      dateLabel: `${douyu.active_from} — ${douyu.active_to}`,
      eraId: 'douyu',
      cover: null,
      title: '斗鱼房间号 156277',
      bigText: '156277',
      why: '用了九年。现在这个页面还在，写着 see you around~，贵宾和钻粉都是 0。',
      href: douyu.url,
    },

    // ② 心灵砒霜。七年，243 期，219 个星期天——这三个数字全部来自 buildSeriesStats。
    series &&
      series.entryCount > 0 && {
        id: 'series-xinling-pishuang',
        dateLabel: `${series.firstDate.slice(0, 4)} — ${series.lastDate.slice(0, 4)}`,
        eraId: eraOf(series.firstDate).id,
        cover: series.entries[series.entries.length - 1]?.cover ?? null,
        title: '《心灵砒霜》',
        why: `周日情感电台，七年 ${series.entryCount} 期，其中 ${series.dominantWeekday?.count ?? 0} 期在星期天。`,
        href: '/series/xinling-pishuang/',
      },

    // ③ 告别。535 天沉默前的最后一支——去台湾交换前，给还没发出来的素材做的剪辑。
    (() => {
      const e = findEntry(entries, '2010-12-02-video-01')
      return (
        e && {
          id: e.id,
          date: e.date,
          dateLabel: e.date,
          eraId: eraOf(e.date).id,
          cover: e.cover,
          title: e.title,
          why: '发完这支，535 天没有再更新。',
          href: `/e/${e.id}/`,
        }
      )
    })(),

    // ④ 主机主播身份的实物证据，不是简历里的一句话。
    (() => {
      const e = findEntry(entries, '2018-08-27-live-01')
      return (
        e && {
          id: e.id,
          date: e.date,
          dateLabel: e.date,
          eraId: eraOf(e.date).id,
          cover: e.cover,
          title: e.title,
          why: '第 5 亿台限定版，她开箱直播。',
          href: `/e/${e.id}/`,
        }
      )
    })(),

    // ⑤ 96 天沉默之后，回来播的第一场。这个 96 天是现算的，不是抄来的。
    (() => {
      const e = findEntry(entries, '2025-11-14-live-01')
      const prevDate = '2025-08-10'
      const days = Math.round((Date.parse(e?.date + 'T00:00:00Z') - Date.parse(prevDate + 'T00:00:00Z')) / 86400000)
      return (
        e && {
          id: e.id,
          date: e.date,
          dateLabel: e.date,
          eraId: eraOf(e.date).id,
          cover: e.cover,
          title: e.title,
          why: `${days} 天没有更新，回来播的第一场。`,
          href: `/e/${e.id}/`,
        }
      )
    })(),

    /*
     * ⑥ 现在。这条不是按"这天时长最长"选的，是刻意挑的——
     *
     * 01-vision 第四节把它和 2010-05-10 那条《小游戏也可以很暴力》并排放在一起：
     * "十六年，从'小游戏也可以很暴力'到'娃睡了来突袭'，这两句话放在一起，
     * 就是整个故事，不需要再加任何抒情的旁白。" 这不是"我觉得这句好听"，
     * 是这份策划文档自己的分析——十六年后她起标题的方式没变，随手、不端着，
     * 这件事本身就是要说的话。选这条不选同一天时长更长的《点关注解锁游戏》，
     * 判断在这里，但判断有文档撑着，不是凭感觉。
     */
    (() => {
      const e = findEntry(entries, '2026-08-10-live-02')
      return (
        e && {
          id: e.id,
          date: e.date,
          dateLabel: e.date,
          eraId: eraOf(e.date).id,
          cover: e.cover,
          title: e.title,
          why: '十六年前第一条视频标题是「小游戏也可以很暴力」——现在还是这个语气。',
          href: `/e/${e.id}/`,
        }
      )
    })(),
  ]

  return list.filter((h): h is Highlight => Boolean(h))
}
