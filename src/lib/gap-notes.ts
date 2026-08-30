/**
 * 档案空白的已知原因。
 *
 * 内容来自 `data/reports/missing-resources.md`（2026-08-26 版审计）——那份表是对外征集缺失资源的入口，
 * 这里只是把其中「哪段时间为什么是空的」搬到前台，方便读者在热力图上直接看到解释。
 * 两处口径必须一致：改这里之前先改那份报告。
 *
 * 硬约束：`known` 只写已经核实的事实，推测一律放进 `guess` 并在界面上标成「推测」，不合并成一句话。
 */

export type GapNote = {
  id: string
  /** 覆盖月份（含端点），YYYY-MM */
  from: string
  to: string
  label: string
  /**
   * gap  = 还需要补档的缺口
   * known = 空白本身有确定解释，不需要补档
   */
  kind: 'gap' | 'known'
  /** 已核实的情况 */
  known: string
  /** 推测，界面上会明确标注 */
  guess?: string
  /** 什么样的材料最有帮助 */
  wanted?: string
}

export const GAP_NOTES: GapNote[] = [
  {
    id: 'video-era',
    from: '2010-01',
    to: '2014-12',
    label: '2010 — 2014 · 视频时期',
    kind: 'known',
    known: '这几年档案里只有视频投稿，直播要到 2015 年 1 月才开始，所以空白月份不代表「少了一场直播」。',
    guess: '大部分空白月更可能是当月本来就没有投稿；但优酷时代有一部分原始页面已经失效，也可能有没被记录下来的投稿。',
    wanted: '旧优酷投稿的备份、页面快照、原始标题与上传时间。',
  },
  {
    id: '2015-early-jan',
    from: '2015-01',
    to: '2015-01',
    label: '2015-01-01 — 01-20',
    kind: 'known',
    known: '首次实际开播已确认是 01-21：本人 B 站与优酷官方旧号均以「[1.21直播录像]」标出该日，2017/2018/2019 年周年录像也倒推至同一天。01-22 是 AcFun「斗鱼首秀」页面的投稿日，不是开播日。',
    guess: '早于 01-21 且能证明是公开直播或测试直播的记录仍未找到，但这不再是「首播日期未定」的冲突。',
    wanted: '早于 1 月 21 日且能明确证明为公开直播或测试直播的录像、公告、截图或直播日历，可作为前史补充。',
  },
  {
    id: '2015-05',
    from: '2015-05',
    to: '2015-05',
    label: '2015-05',
    kind: 'gap',
    known: '多轮扫描后仍没有找到这个月的可靠录像或开播记录。',
    guess: '可能当时真实低频，也可能录像没有被公开保存下来。',
    wanted: '任意可核验的直播录像、斗鱼回放 ID、旧网盘或硬盘目录。',
  },
  {
    id: 'early-live',
    from: '2015-06',
    to: '2017-02',
    label: '2015 — 2017 初 · 早期直播',
    kind: 'gap',
    known: '多轮 B 站 / AcFun / 优酷 / 补投账号扫描之后，仍然无法完整覆盖这段时间的实际直播量。',
    guess: '公开网络上很可能已经缺失一部分原始录像，这段是目前最值得帮忙找的区域。',
    wanted: '旧录像、私人网盘、硬盘目录、完整回放目录、旧斗鱼页面或长期直播日历。',
  },
  {
    id: '2016-02',
    from: '2016-02',
    to: '2016-02',
    label: '2016-02',
    kind: 'known',
    known: '已经确认 02-19《毛线小精灵 UNRAVEL》与 02-21《心灵砒霜》两场。',
    guess: '全量补投扫描后更倾向于春节期间真实低频 / 停播，而不是还有一批没被发现的录像。',
  },
  {
    id: '2020-missing-days',
    from: '2020-03',
    to: '2020-11',
    label: '2020 的四个缺档直播日',
    kind: 'known',
    known: '贴吧日志曾确认 03-05（聊天）、08-18（唱歌）、09-21（唱歌）当天开播但无对应录像；调查中又发现 11-25 也遗漏。四天均已找到完整 B 站录播并建立正式条目，不再是缺口。',
  },
  {
    id: 'douyu-stop-tail',
    from: '2024-04',
    to: '2024-07',
    label: '2024-04 — 2024-07 · 停播后期的空档',
    kind: 'known',
    known:
      '斗鱼直播停在 2023 年 11 月 30 日，抖音 2024 年 8 月 18 日复播。中间并非全空：2023-12 至 2024-03 还有 7 场 B 站「夜话 / 话疗」；真正一条记录都没有的只有 2024 年 4 — 7 月。',
  },
]

/** 命中某个月份的原因说明；多条命中时优先返回范围更窄的那条。 */
export function noteForMonth(year: number, month: number): GapNote | undefined {
  const key = `${year}-${String(month).padStart(2, '0')}`
  return GAP_NOTES.filter((note) => key >= note.from && key <= note.to).sort(
    (a, b) => span(a) - span(b),
  )[0]
}

function span(note: GapNote): number {
  const [fy, fm] = note.from.split('-').map(Number)
  const [ty, tm] = note.to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}
