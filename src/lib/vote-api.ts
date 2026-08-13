export type VoteCandidate = { gameId: string; label: string }

export type VoteTaskSummary = {
  id: string
  entryId: string
  entryTitle: string
  prompt: string
  selection: 'single' | 'multiple'
  candidates: VoteCandidate[]
  allowNone: boolean
  allowUnsure: boolean
  minimumVotes: number
  consensusThreshold: number
  totalVotes: number
}

export type VoteAggregate = {
  taskId: string
  totalVotes: number
  noneVotes: number
  unsureVotes: number
  candidateVotes: Record<string, number>
  leadingGameIds: string[]
  consensus: number
}

export type VoteViewer = {
  hasVoted: boolean
  answer: 'selection' | 'none' | 'unsure' | null
  selectedGameIds: string[]
  maxSubmissionsPerTask: number
}

export type VoteTaskDetail = {
  task: Omit<VoteTaskSummary, 'totalVotes'>
  aggregate: VoteAggregate
  viewer: VoteViewer
}

const VOTE_API_BASE = (process.env.NEXT_PUBLIC_VOTE_API_BASE ?? '').replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${VOTE_API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  const body = (await response.json().catch(() => null)) as ({ message?: string } & T) | null
  if (!response.ok) throw new Error(body?.message ?? '投票服务暂时不可用')
  if (!body) throw new Error('投票服务返回了空响应')
  return body
}

export async function listVoteTasks(): Promise<VoteTaskSummary[]> {
  const result = await request<{ tasks: VoteTaskSummary[] }>('/api/vote/tasks')
  return result.tasks
}

export function getVoteTask(taskId: string): Promise<VoteTaskDetail> {
  return request(`/api/vote/tasks/${encodeURIComponent(taskId)}`)
}

export function submitVote(
  taskId: string,
  submission: {
    answer: 'selection' | 'none' | 'unsure'
    selectedGameIds: string[]
    otherText?: string
  },
): Promise<{ status: 'ok'; aggregate: VoteAggregate; viewer: VoteViewer }> {
  return request(`/api/vote/tasks/${encodeURIComponent(taskId)}`, {
    method: 'POST',
    body: JSON.stringify(submission),
  })
}
