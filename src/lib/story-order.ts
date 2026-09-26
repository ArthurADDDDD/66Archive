/**
 * 编年史同一年里的卡按展示日期排。
 *
 * 以前同年内的顺序就是后台列表（或 narrative.ts 数组）的顺序，而后台的故事模式列表
 * 早就按展示日期显示了——两边看到的顺序不一样，线上于是出现 2023 年 11 月的
 * see you around 排在 1 月八周年前面、2017 年的年报三连排在年末这种情况。
 *
 * 口径与后台 `NarrativeManager` 的 `storyDateKey` 完全一致：取展示日期里第一个
 * `YYYY[.MM][.DD]`，缺月 / 缺日按 00（排在该年 / 该月最前）；解析不出日期的排到最后。
 * 月份的交替分支必须先试两位（`1[0-2]` 在 `0?[1-9]` 前），否则「2016.10」会被读成 1 月。
 * 排序必须是稳定的：同一天（或都只写到年）的卡保留后台人工顺序。
 */
export function storyDateKey(value: string | undefined): string {
  const match = (value ?? '').match(/(\d{4})(?:[.-](1[0-2]|0?[1-9]))?(?:[.-](\d{1,2}))?/)
  if (!match) return `9999-99-99-${value ?? ''}`
  return `${match[1]}-${(match[2] ?? '00').padStart(2, '0')}-${(match[3] ?? '00').padStart(2, '0')}`
}

/** 稳定排序：日期相同的保持传入顺序。 */
export function byStoryDate<T extends { date: string }>(beats: readonly T[]): T[] {
  return beats
    .map((beat, index) => ({ beat, index, key: storyDateKey(beat.date) }))
    .sort((a, b) => a.key.localeCompare(b.key) || a.index - b.index)
    .map(({ beat }) => beat)
}
