'use client'

import { useMemo, useState } from 'react'
import {
  getVoteTask,
  listVoteTasks,
  submitVote,
  type VoteTaskDetail,
} from '@/lib/vote-api'
import { gameColor } from '@/lib/ui'

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
  const [answer, setAnswer] = useState<Answer>('selection')
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([])
  const [otherText, setOtherText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const candidateIds = useMemo(
    () => new Set(detail?.task.candidates.map((candidate) => candidate.gameId) ?? []),
    [detail],
  )

  const revealVoting = async () => {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    if (detail || loading || error) return
    setLoading(true)
    try {
      const tasks = await listVoteTasks()
      const task = tasks.find((candidate) => candidate.entryId === entryId)
      if (!task) {
        setError('这条记录暂未开放投票。管理员开放候选标签后，可以直接在这里校准。')
        return
      }
      const next = await getVoteTask(task.id)
      setDetail(next)
      setAnswer(next.viewer.answer ?? 'selection')
      setSelectedGameIds(next.viewer.selectedGameIds)
    } catch {
      setError('投票服务暂时没有响应，请稍后再试。')
    } finally {
      setLoading(false)
    }
  }

  const chooseCandidate = (gameId: string) => {
    if (!detail || !candidateIds.has(gameId)) return
    setAnswer('selection')
    setOtherText('')
    setSelectedGameIds((current) => {
      if (detail.task.selection === 'single') return [gameId]
      return current.includes(gameId) ? current.filter((id) => id !== gameId) : [...current, gameId]
    })
    setMessage(null)
  }

  const chooseAnswer = (next: Exclude<Answer, 'selection'>) => {
    setAnswer(next)
    setSelectedGameIds([])
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
          <p className="text-meta uppercase tracking-[0.16em] text-faint">当前识别标签</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {games.length > 0 ? games.map((game) => (
              <span key={game.id} className="inline-flex min-h-8 items-center gap-2 rounded-full border border-line bg-base/45 px-3 text-control text-muted">
                <span className="h-2 w-2 rounded-sm" style={{ background: gameColor(game.id) }} />
                {game.name}
              </span>
            )) : <span className="text-control text-faint">暂未识别出游戏</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={revealVoting}
          aria-expanded={open}
          className="ui-press min-h-10 rounded-full border border-live/35 bg-live/8 px-4 text-control text-live hover:bg-live/14"
        >
          {open ? '收起校准' : '标签不对？帮我校准'}
        </button>
      </div>

      <p className="mt-3 text-meta leading-relaxed text-faint">
        指引：先打开上方录像确认内容；标签不符合时，在这里选择实际出现的游戏。拿不准可以选“无法判断”。
      </p>

      {open && (
        <div className="ui-panel-in mt-4 rounded-xl border border-line bg-base/40 p-4">
          {loading && <p className="text-control text-muted">正在载入这条记录的候选标签…</p>}
          {!loading && error && <p role="status" className="text-control leading-relaxed text-muted">{error}</p>}
          {!loading && detail && (
            <>
              <p className="text-control font-medium text-ink">{detail.task.prompt}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {detail.task.candidates.map((candidate) => {
                  const selected = answer === 'selection' && selectedGameIds.includes(candidate.gameId)
                  return (
                    <button
                      key={candidate.gameId}
                      type="button"
                      onClick={() => chooseCandidate(candidate.gameId)}
                      aria-pressed={selected}
                      className={`ui-press min-h-11 rounded-lg border px-3 py-2 text-left text-control ${selected ? 'border-live/55 bg-live/12 text-ink' : 'border-line text-muted hover:border-muted hover:text-ink'}`}
                    >
                      {selected ? '✓ ' : ''}{candidate.label}
                    </button>
                  )
                })}
                {detail.task.allowNone && (
                  <button type="button" onClick={() => chooseAnswer('none')} aria-pressed={answer === 'none'} className={`ui-press min-h-11 rounded-lg border px-3 py-2 text-left text-control ${answer === 'none' ? 'border-video/55 bg-video/10 text-ink' : 'border-line text-muted hover:border-muted hover:text-ink'}`}>
                    都不对 / 其他
                  </button>
                )}
                {detail.task.allowUnsure && (
                  <button type="button" onClick={() => chooseAnswer('unsure')} aria-pressed={answer === 'unsure'} className={`ui-press min-h-11 rounded-lg border px-3 py-2 text-left text-control ${answer === 'unsure' ? 'border-faint bg-raised text-ink' : 'border-line text-muted hover:border-muted hover:text-ink'}`}>
                    无法判断
                  </button>
                )}
              </div>
              {answer === 'none' && (
                <label className="mt-3 block text-meta text-faint">
                  你认为是什么？（可不填，仅管理员可见）
                  <textarea value={otherText} onChange={(event) => setOtherText(event.target.value.slice(0, 200))} rows={2} className="mt-2 w-full resize-y rounded-lg border border-line bg-base/60 px-3 py-2 text-control text-ink outline-none placeholder:text-faint focus:border-video" placeholder="例如：实际在播某款游戏，或这段不是游戏内容。" />
                </label>
              )}
              {message && <p role="status" className="mt-3 text-control text-live">{message}</p>}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-meta text-faint">无需注册；结果只作为人工复核线索。</p>
                <button type="button" onClick={sendVote} disabled={!canSubmit} className="ui-press min-h-10 rounded-full bg-ink px-5 text-control font-semibold text-base disabled:cursor-not-allowed disabled:opacity-35">
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
