'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getVoteTaskByEntry,
  listVoteGames,
  submitVote,
  type VoteGame,
  type VoteTaskDetail,
} from '@/lib/vote-api'
import { gameColor } from '@/lib/ui'
import { searchGames } from '@/lib/vote-search'

/**
 * 条目内嵌的「这场标的游戏对不对」投票。
 *
 * ## 这一版改了什么
 * 上一版要求管理员先为某条记录开任务，而他一个都没开过，于是每条记录都显示
 * 「暂未开放投票」——功能等于不存在。现在服务端按需自动开任务，所以**每条记录
 * 随时都能投**，前台不再有「未开放」这个状态。
 *
 * 同时候选不再是全集：以前只能在管理员挑的几个里选，认出别的游戏也没处填，
 * 只能点「都不对」，等于把一个已知答案降级成一条要人工再查的模糊反馈。
 * 现在可以搜整个游戏词库，词库里确实没有的才落到自由文本。
 */

type GameTag = { id: string; name: string }
type Answer = 'selection' | 'none' | 'unsure'

export function InlineTagCalibration({
  entryId,
  games,
}: {
  entryId: string
  games: GameTag[]
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<VoteTaskDetail | null>(null)
  const [catalog, setCatalog] = useState<VoteGame[] | null>(null)
  const [answer, setAnswer] = useState<Answer>('selection')
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [otherText, setOtherText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const searchRef = useRef<HTMLInputElement | null>(null)

  /**
   * gameId → 显示名。候选自带 label，词库补上候选之外的那些。
   *
   * 需要合并是因为选中的游戏可以来自搜索框，而它不在 task.candidates 里；
   * 只看候选的话，用户刚选中的那一项会显示成一串 id。
   */
  const labels = useMemo(() => {
    const map = new Map<string, string>()
    for (const game of games) map.set(game.id, game.name)
    for (const candidate of detail?.task.candidates ?? []) map.set(candidate.gameId, candidate.label)
    for (const game of catalog ?? []) if (!map.has(game.id)) map.set(game.id, game.name)
    return map
  }, [games, detail, catalog])

  /** 摆出来的选项 = 这条记录现在标的游戏 + 用户从搜索框加进来的。 */
  const chipIds = useMemo(() => {
    const ids = (detail?.task.candidates ?? []).map((candidate) => candidate.gameId)
    return [...ids, ...selectedGameIds.filter((id) => !ids.includes(id))]
  }, [detail, selectedGameIds])

  const results = useMemo(() => (catalog ? searchGames(catalog, keyword) : []), [catalog, keyword])

  useEffect(() => {
    if (pickerOpen) searchRef.current?.focus()
  }, [pickerOpen])

  const revealVoting = async () => {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    if (detail || loading) return
    setLoading(true)
    setError(null)
    try {
      // 词库和任务一起拉：任务详情里可能带着这位访客上次选的、候选之外的游戏，
      // 没有词库就只能把它显示成 id。词库整页只拉一次（见 listVoteGames）。
      const [next, allGames] = await Promise.all([
        getVoteTaskByEntry(entryId),
        listVoteGames().catch(() => null),
      ])
      setDetail(next)
      setCatalog(allGames)
      setAnswer(next.viewer.answer ?? 'selection')
      setSelectedGameIds(next.viewer.selectedGameIds)
      // 这条记录还没标过游戏 → 没有候选可点，直接把搜索框摆出来，
      // 否则用户看到的是一片空白加两个「都不对 / 无法判断」。
      if (next.task.candidates.length === 0 && next.viewer.selectedGameIds.length === 0) {
        setPickerOpen(true)
      }
    } catch {
      setError('投票服务暂时没有响应，请稍后再试。')
    } finally {
      setLoading(false)
    }
  }

  const toggleGame = (gameId: string) => {
    if (!detail) return
    setAnswer('selection')
    setOtherText('')
    setMessage(null)
    setSelectedGameIds((current) => {
      if (detail.task.selection === 'single') return current.includes(gameId) ? [] : [gameId]
      return current.includes(gameId) ? current.filter((id) => id !== gameId) : [...current, gameId]
    })
  }

  const chooseAnswer = (next: Exclude<Answer, 'selection'>) => {
    setAnswer(next)
    setSelectedGameIds([])
    setPickerOpen(false)
    if (next !== 'none') setOtherText('')
    setMessage(null)
  }

  const canSubmit = Boolean(
    detail && !submitting && (
      (answer === 'selection' && selectedGameIds.length > 0)
      || answer === 'none'
      || answer === 'unsure'
    ),
  )

  const sendVote = async () => {
    if (!detail || !canSubmit) return
    setSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      const result = await submitVote(detail.task.id, {
        answer,
        selectedGameIds: answer === 'selection' ? selectedGameIds : [],
        ...(answer === 'none' && otherText.trim() ? { otherText: otherText.trim() } : {}),
      })
      setDetail((current) => current ? { ...current, aggregate: result.aggregate, viewer: result.viewer } : current)
      setMessage(detail.viewer.hasVoted ? '你的判断已更新。' : '收到。你的判断会交给管理员复核，不会自动改写档案。')
      setPickerOpen(false)
      setKeyword('')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '提交失败，请稍后再试。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mt-4 border-t border-line pt-4" aria-label="标签校准">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-meta uppercase tracking-[0.16em] text-faint">这场标的游戏</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {games.length > 0 ? games.map((game) => (
              <span key={game.id} className="inline-flex min-h-8 items-center gap-2 rounded-full border border-line bg-base/45 px-3 text-control text-muted">
                <span className="h-2 w-2 rounded-sm" style={{ background: gameColor(game.id) }} />
                {game.name}
              </span>
            )) : <span className="text-control text-faint">这场还没有标游戏</span>}
          </div>
        </div>
        <button
          type="button"
          data-analytics-event="calibration.open"
          onClick={revealVoting}
          aria-expanded={open}
          className="ui-press min-h-10 rounded-full border border-live/35 bg-live/8 px-4 text-control text-live hover:bg-live/14"
        >
          {open ? '收起' : games.length > 0 ? '标错了？帮忙改一下' : '知道这场玩的什么？'}
        </button>
      </div>

      <p className="mt-3 text-meta leading-relaxed text-faint">
        打开上面的录像看一眼，如果标错了，在这里选实际玩的游戏。拿不准可以选「无法判断」。
      </p>

      {open && (
        <div className="ui-panel-in mt-4 rounded-xl border border-line bg-base/40 p-4">
          {loading && <p className="text-control text-muted">正在载入…</p>}
          {!loading && error && !detail && <p role="status" className="text-control leading-relaxed text-muted">{error}</p>}
          {!loading && detail && (
            <>
              <p className="text-control font-medium text-ink">{detail.task.prompt}</p>

              {chipIds.length > 0 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {chipIds.map((gameId) => {
                    const selected = answer === 'selection' && selectedGameIds.includes(gameId)
                    return (
                      <button
                        key={gameId}
                        type="button"
                        onClick={() => toggleGame(gameId)}
                        aria-pressed={selected}
                        className={`ui-press min-h-11 rounded-lg border px-3 py-2 text-left text-control ${selected ? 'border-live/55 bg-live/12 text-ink' : 'border-line text-muted hover:border-muted hover:text-ink'}`}
                      >
                        {selected ? '✓ ' : ''}{labels.get(gameId) ?? gameId}
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => { setPickerOpen((value) => !value); setMessage(null) }}
                  aria-expanded={pickerOpen}
                  className={`ui-press min-h-11 rounded-lg border px-3 py-2 text-left text-control ${pickerOpen ? 'border-live/45 bg-live/8 text-ink' : 'border-line text-muted hover:border-muted hover:text-ink'}`}
                >
                  {chipIds.length > 0 ? '都不对，是别的游戏…' : '搜索游戏…'}
                </button>
                {detail.task.allowUnsure && (
                  <button type="button" onClick={() => chooseAnswer('unsure')} aria-pressed={answer === 'unsure'} className={`ui-press min-h-11 rounded-lg border px-3 py-2 text-left text-control ${answer === 'unsure' ? 'border-faint bg-raised text-ink' : 'border-line text-muted hover:border-muted hover:text-ink'}`}>
                    无法判断
                  </button>
                )}
              </div>

              {pickerOpen && (
                <div className="mt-3 rounded-lg border border-line bg-base/50 p-3">
                  {catalog === null ? (
                    <p className="text-control text-muted">游戏词库没能载入，你可以在下面直接写下游戏名。</p>
                  ) : (
                    <>
                      <label className="block text-meta text-faint">
                        搜索游戏（共 {catalog.length} 款）
                        <input
                          ref={searchRef}
                          type="text"
                          value={keyword}
                          onChange={(event) => setKeyword(event.target.value.slice(0, 60))}
                          placeholder="输入游戏名，中英文、别名都可以"
                          className="mt-2 min-h-11 w-full rounded-lg border border-line bg-base/60 px-3 text-control text-ink outline-none placeholder:text-faint focus:border-live"
                        />
                      </label>
                      {keyword.trim() && (
                        <div className="mt-3 max-h-64 overflow-y-auto">
                          {results.length > 0 ? (
                            <ul className="grid gap-1">
                              {results.map((game) => {
                                const selected = answer === 'selection' && selectedGameIds.includes(game.id)
                                return (
                                  <li key={game.id}>
                                    <button
                                      type="button"
                                      onClick={() => toggleGame(game.id)}
                                      aria-pressed={selected}
                                      className={`ui-press flex min-h-10 w-full items-center gap-2 rounded-md border px-3 text-left text-control ${selected ? 'border-live/55 bg-live/12 text-ink' : 'border-transparent text-muted hover:border-line hover:text-ink'}`}
                                    >
                                      <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: gameColor(game.id) }} />
                                      <span className="truncate">{selected ? '✓ ' : ''}{game.name}</span>
                                    </button>
                                  </li>
                                )
                              })}
                            </ul>
                          ) : (
                            <p className="text-control text-faint">词库里没有匹配的游戏。</p>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* 词库里确实没有的游戏才走自由文本——这条会进人工队列，
                      比一个能直接落盘的 game id 贵得多，所以放在搜索之后而不是并列。 */}
                  <button
                    type="button"
                    onClick={() => chooseAnswer('none')}
                    aria-pressed={answer === 'none'}
                    className={`ui-press mt-3 min-h-10 rounded-full border px-4 text-control ${answer === 'none' ? 'border-video/55 bg-video/10 text-ink' : 'border-line text-muted hover:border-muted hover:text-ink'}`}
                  >
                    都找不到？直接写下来
                  </button>
                </div>
              )}

              {answer === 'none' && (
                <label className="mt-3 block text-meta text-faint">
                  你认为是什么？（可不填，仅管理员可见）
                  <textarea value={otherText} onChange={(event) => setOtherText(event.target.value.slice(0, 200))} rows={2} className="mt-2 w-full resize-y rounded-lg border border-line bg-base/60 px-3 py-2 text-control text-ink outline-none placeholder:text-faint focus:border-video" placeholder="例如：实际在播某款游戏，或这段不是游戏内容。" />
                  <span className="mt-1 block text-right tnum">{[...otherText].length} / 200</span>
                </label>
              )}

              {message && <p role="status" className="mt-3 text-control text-live">{message}</p>}
              {error && <p role="alert" className="mt-3 text-control text-video">{error}</p>}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-meta text-faint">无需注册；结果只作为人工复核线索。</p>
                <button
                  type="button"
                  data-analytics-event="calibration.submit"
                  onClick={sendVote}
                  disabled={!canSubmit}
                  className="ui-press min-h-10 rounded-full bg-ink px-5 text-control font-semibold text-base disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {submitting ? '提交中…' : detail.viewer.hasVoted ? '更新判断' : '提交判断'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
