import type { TimelineEntry } from './data'
import { RELATED_FOOTAGE_LEADS, REVIEWED_GAPS } from './game-footage-evidence'
import { SPECIFIC_GAME_PARENTS } from './games'

export type GameFootageCopy = { label: string; title: string; detail: string; relatedLead?: { url: string; label: string; detail: string } }

function matches(candidate: string, game: string): boolean {
  return candidate === game || SPECIFIC_GAME_PARENTS[candidate] === game
}

/** Shared reader-facing wording for unavailable game-specific recordings. */
export function getGameFootageCopy(entry: TimelineEntry): GameFootageCopy {
  const gap = REVIEWED_GAPS.find(item =>
    item.entry === entry.id && item.games.some(game => entry.games.some(candidate => matches(candidate.id, game))),
  )
  const related = RELATED_FOOTAGE_LEADS.find(item =>
    item.entry === entry.id && entry.games.some(candidate => matches(candidate.id, item.game)),
  )
  const relatedLead = related ? { url: related.url, label: related.label, detail: related.detail } : undefined
  if (relatedLead) {
    return {
      label: '整场未确认',
      title: '有相关精剪，整场录像尚未确认',
      detail: '相关精剪可以观看；直播日期仍未确定，暂不认定为本场整场录像。',
      relatedLead,
    }
  }
  if (entry.gameFootageNotice === 'partial') {
    return {
      label: '仅有片段',
      title: '目前只找到相关片段',
      detail: '现有片段不能当作整场录像观看。',
    }
  }
  if (entry.gameFootageNotice === 'unverified') {
    if (gap?.status === 'playable_complement') {
      return {
        label: '尚未定位',
        title: '已找到补充录像，尚未定位游戏片段',
        detail: '这场已有可播放的补充录像，但还没有定位到对应游戏的片段。',
      }
    }
    if (gap?.status === 'source_unverified') {
      return {
        label: '来源待核实',
        title: '对应来源尚未核实',
        detail: '现有来源还不能确认是否包含这款游戏的录像。',
      }
    }
    return {
      label: '尚未核实或定位',
      title: '尚未核实或定位对应录像',
      detail: '来源状态或对应游戏片段尚未核实、定位，因此暂不作为当前游戏的播放入口。'
    }
  }
  return {
    label: '未找到录像',
    title: '暂未找到对应游戏录像',
    detail: '目前没有可确认属于这款游戏的公开录像。',
    ...(relatedLead ? { relatedLead } : {}),
  }
}
