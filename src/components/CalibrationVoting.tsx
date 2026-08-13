'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getVoteTask,
  listVoteTasks,
  submitVote,
  type VoteTaskDetail,
  type VoteTaskSummary,
} from '@/lib/vote-api'

type Answer = 'selection' | 'none' | 'unsure'

export function CalibrationVoting() {
  const [tasks, setTasks] = useState<VoteTaskSummary[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [detail, setDetail] = useState<VoteTaskDetail | null>(null)
  const [answer, setAnswer] = useState<Answer>('selection')
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([])
  const [otherText, setOtherText] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadTask = useCallback(async (taskId: string) => {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const next = await getVoteTask(taskId)
      setDetail(next)
      setAnswer(next.viewer.answer ?? 'selection')
      setSelectedGameIds(next.viewer.selectedGameIds)
      setOtherText('')
    } catch (loadError) {
      setDetail(null)
      setError(loadError instanceof Error ? loadError.message : '任务载入失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    listVoteTasks()
      .then((nextTasks) => {
        if (!active) return
        setTasks(nextTasks)
        const first = nextTasks[0]?.id ?? null
        setSelectedTaskId(first)
        if (first) return loadTask(first)
        setLoading(false)
      })
      .catch((loadError) => {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : '任务列表载入失败')
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [loadTask])

  const candidateById = useMemo(
    () => new Map(detail?.task.candidates.map((candidate) => [candidate.gameId, candidate]) ?? []),
    [detail],
  )

  const chooseTask = (taskId: string) => {
    if (taskId === selectedTaskId) return
    setSelectedTaskId(taskId)
    void loadTask(taskId)
  }

  const chooseCandidate = (gameId: string) => {
    if (!detail) return
    setAnswer('selection')
    setOtherText('')
    if (detail.task.selection === 'single') {
      setSelectedGameIds([gameId])
    } else {
      setSelectedGameIds((current) => current.includes(gameId) ? current.filter((id) => id !== gameId) : [...current, gameId])
    }
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

  const previousAnswer = detail?.viewer.answer === 'selection'
    ? `：${detail.viewer.selectedGameIds.map((id) => candidateById.get(id)?.label ?? id).join('、')}`
    : detail?.viewer.answer === 'none'
      ? '“其他”'
      : '“无法判断”'

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
      setMessage(detail.viewer.hasVoted ? '你的选择已更新。' : '收到，谢谢你帮忙校准这条记录。')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '提交失败，请稍后再试')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && tasks.length === 0) {
    return <StatePanel title="正在取一条待校准记录…" body="这里只加载管理员已经开放的候选标签。" pulse />
  }

  if (error && tasks.length === 0) {
    return <StatePanel title="投票服务暂时没有响应" body={error} />
  }

  if (tasks.length === 0) {
    return <StatePanel title="这一轮已经校准完了" body="管理员开放新样本后，它们会出现在这里。" />
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="rounded-2xl border border-line bg-surface/55 p-5 sm:p-7">
        {loading || !detail ? (
          <StatePanel title="正在切换样本…" body="候选标签由管理员预先给出。" pulse />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="rounded-full border border-live/30 bg-live/10 px-3 py-1.5 text-meta text-live">
                样本 {tasks.findIndex((task) => task.id === detail.task.id) + 1} / {tasks.length}
              </span>
              <span className="text-meta text-faint">不需要注册 · 可以回来改票</span>
            </div>

            <h2 className="mt-6 text-h2 font-semibold text-ink">{detail.task.prompt}</h2>
            <p className="mt-3 text-body text-muted">{detail.task.entryTitle}</p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {detail.task.candidates.map((candidate) => {
                const selected = answer === 'selection' && selectedGameIds.includes(candidate.gameId)
                return (
                  <button
                    key={candidate.gameId}
                    type="button"
                    onClick={() => chooseCandidate(candidate.gameId)}
                    aria-pressed={selected}
                    className={`ui-press flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 text-left text-control ${selected ? 'border-live/55 bg-live/12 text-ink shadow-[0_10px_30px_rgba(91,200,232,.08)]' : 'border-line bg-base/40 text-muted hover:border-muted hover:text-ink'}`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center border ${detail.task.selection === 'single' ? 'rounded-full' : 'rounded-md'} ${selected ? 'border-live bg-live text-base' : 'border-faint'}`}>
                      {selected ? '✓' : ''}
                    </span>
                    {candidate.label}
                  </button>
                )
              })}

              {detail.task.allowNone && (
                <button type="button" onClick={() => chooseAnswer('none')} aria-pressed={answer === 'none'} className={`ui-press min-h-14 rounded-xl border px-4 py-3 text-left text-control ${answer === 'none' ? 'border-video/55 bg-video/10 text-ink' : 'border-line bg-base/40 text-muted hover:border-muted hover:text-ink'}`}>
                  都不是 / 其他
                </button>
              )}
              {detail.task.allowUnsure && (
                <button type="button" onClick={() => chooseAnswer('unsure')} aria-pressed={answer === 'unsure'} className={`ui-press min-h-14 rounded-xl border px-4 py-3 text-left text-control ${answer === 'unsure' ? 'border-faint bg-raised text-ink' : 'border-line bg-base/40 text-muted hover:border-muted hover:text-ink'}`}>
                  无法判断
                </button>
              )}
            </div>

            {answer === 'none' && (
              <label className="mt-4 block text-meta text-faint">
                你觉得是什么？（可不填，最多 200 字）
                <textarea
                  value={otherText}
                  onChange={(event) => setOtherText(event.target.value.slice(0, 200))}
                  rows={3}
                  placeholder="只会交给管理员核验，不会展示给其他游客。"
                  className="mt-2 w-full resize-y rounded-xl border border-line bg-base/55 px-4 py-3 text-control text-ink outline-none placeholder:text-faint focus:border-video"
                />
                <span className="mt-1 block text-right font-mono tnum">{[...otherText].length} / 200</span>
              </label>
            )}

            {error && <p role="alert" className="mt-4 rounded-xl border border-today/30 bg-today/8 px-4 py-3 text-control text-today">{error}</p>}
            {message && <p role="status" className="mt-4 rounded-xl border border-live/30 bg-live/8 px-4 py-3 text-control text-live">{message}</p>}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-meta text-faint">
                {detail.viewer.hasVoted
                  ? `你上次选择了${previousAnswer}`
                  : '结果不会自动改写档案，管理员会逐条复核。'}
              </p>
              <button type="button" onClick={sendVote} disabled={!canSubmit} className="ui-press min-h-12 rounded-full bg-ink px-6 text-control font-semibold text-base disabled:cursor-not-allowed disabled:opacity-35">
                {submitting ? '提交中…' : detail.viewer.hasVoted ? '更新我的选择' : '提交判断'}
              </button>
            </div>

            {detail.viewer.hasVoted && <ResultSummary detail={detail} />}
          </>
        )}
      </section>

      <aside className="rounded-2xl border border-line bg-surface/35 p-4 sm:p-5">
        <p className="text-meta uppercase tracking-[0.16em] text-faint">Open samples</p>
        <h2 className="mt-2 text-h3 font-semibold text-ink">待校准样本</h2>
        <div className="mt-4 space-y-2">
          {tasks.map((task, index) => (
            <button key={task.id} type="button" onClick={() => chooseTask(task.id)} className={`ui-press w-full rounded-xl border p-3 text-left ${selectedTaskId === task.id ? 'border-live/40 bg-live/8' : 'border-line bg-base/35 hover:border-muted'}`}>
              <span className="block text-meta text-faint">#{String(index + 1).padStart(2, '0')} · {task.selection === 'single' ? '单选' : '可多选'}</span>
              <span className="mt-1 line-clamp-2 block text-control text-muted">{task.entryTitle}</span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  )
}

function ResultSummary({ detail }: { detail: VoteTaskDetail }) {
  const rows = detail.task.candidates
    .map((candidate) => ({ ...candidate, votes: detail.aggregate.candidateVotes[candidate.gameId] ?? 0 }))
    .sort((a, b) => b.votes - a.votes)
  return (
    <div className="mt-7 border-t border-line pt-6">
      <div className="flex items-end justify-between gap-4">
        <div><p className="text-meta uppercase tracking-[0.16em] text-live">Current sample</p><h3 className="mt-2 text-h3 font-semibold text-ink">当前样本分布</h3></div>
        <span className="font-mono text-meta text-faint tnum">{detail.aggregate.totalVotes} 票</span>
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((row) => {
          const ratio = detail.aggregate.totalVotes ? row.votes / detail.aggregate.totalVotes : 0
          return (
            <div key={row.gameId}>
              <div className="flex justify-between gap-3 text-meta"><span className="text-muted">{row.label}</span><span className="font-mono text-faint tnum">{Math.round(ratio * 100)}%</span></div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-live" style={{ width: `${ratio * 100}%` }} /></div>
            </div>
          )
        })}
      </div>
      <p className="mt-4 text-meta leading-relaxed text-faint">票数只帮助管理员定位可能的误标，不代表史料结论，也不会自动生效。</p>
    </div>
  )
}

function StatePanel({ title, body, pulse = false }: { title: string; body: string; pulse?: boolean }) {
  return (
    <div className="flex min-h-[28rem] flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/30 p-8 text-center">
      <span className={`h-2.5 w-2.5 rounded-full bg-live ${pulse ? 'ui-now-pulse' : ''}`} />
      <h2 className="mt-5 text-h3 font-semibold text-ink">{title}</h2>
      <p className="mt-3 max-w-md text-body text-muted">{body}</p>
    </div>
  )
}
