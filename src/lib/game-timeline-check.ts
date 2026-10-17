/**
 * 游戏时间轴与条目之间的交叉校验（npm run validate 调用）。
 *
 * 单条时间轴自身的结构（分 P 升序、环节递增、part 精度只能落在分 P 开头……）由 schema 保证；
 * 这里查的是它和条目对不对得上。引用错了页面不会报错，只会让跳转落到别的分 P、
 * 或把时长算给别的游戏，所以全部按错误拦下。
 */
import { buildSourceGroups } from './data'
import { parseBasis, recordedSec } from './game-time'
import { detectPlatform } from './platforms'
import { TIMELINE_PLATFORMS, type Entry, type GameTimeline } from './schema'

export function checkGameTimelines(entries: Entry[], timelines: GameTimeline[]): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const byId = new Map(entries.map((e) => [e.id, e]))
  const groups = buildSourceGroups(entries)
  const timelineByGroup = new Map<string, string>()

  const today = new Date().toISOString().slice(0, 10)
  for (const t of timelines) {
    const where = `game-timelines.yaml → "${t.entry}"`
    if (t.reviewed > today) errors.push(`${where} 的人工确认日期 ${t.reviewed} 在未来`)
    const entry = byId.get(t.entry)
    if (!entry) {
      errors.push(`${where} 指向不存在的条目`)
      continue
    }
    // 同场合并后统计按代表条目计；挂在别的成员上会被统计静默忽略。
    const group = groups.get(entry.id) ?? [entry]
    const representative = group[0]
    if (representative.id !== entry.id) {
      errors.push(`${where} 属于同场合并组，时间轴要挂在代表条目 "${representative.id}" 上`)
    }
    const prior = timelineByGroup.get(representative.id)
    if (prior) errors.push(`${where} 与 "${prior}" 是同一场，同一场只能有一条时间轴`)
    else timelineByGroup.set(representative.id, entry.id)

    if (!group.some((item) => item.sources.some((s) => s.url === t.basis))) {
      errors.push(`${where} 的 basis 不是这一场任何来源的 url：${t.basis}`)
    }
    const platform = detectPlatform(t.basis)
    if (!platform || !(TIMELINE_PLATFORMS as readonly string[]).includes(platform)) {
      errors.push(`${where} 的 basis 平台「${platform ?? '未知'}」还不支持：分 P 与跳转语义只在 ${TIMELINE_PLATFORMS.join('、')} 上实测过`)
    } else if (!parseBasis(t.basis)) {
      errors.push(`${where} 的 basis 里取不到视频号（B 站要有 BV 号，A 站要有 ac 号），无法生成跳转`)
    }

    const spanGames = new Set(t.spans.flatMap((s) => (s.game ? [s.game] : [])))
    for (const g of spanGames) {
      if (!entry.games.includes(g)) errors.push(`${where} 的环节引用了 "${g}"，但它不在条目的 games 里`)
    }
    if (t.coverage === 'complete') {
      const missing = entry.games.filter((g) => !spanGames.has(g))
      if (missing.length) {
        errors.push(`${where} 标了整场覆盖，但 games 里的 ${missing.join('、')} 没有任何环节；要么补环节，要么改 coverage 或 games`)
      }
      const recordedMin = recordedSec(t) / 60
      if (entry.duration_min && Math.abs(recordedMin - entry.duration_min) > 10) {
        warnings.push(`${where} 标了整场覆盖，但分 P 合计 ${Math.round(recordedMin)} 分钟，与条目时长 ${entry.duration_min} 分钟相差超过 10 分钟`)
      }
    }
  }
  return { errors, warnings }
}
