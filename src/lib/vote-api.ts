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

/**
 * 按记录 id 直接取投票详情。服务端没有任务就地建一个，所以**每条记录都能投**。
 *
 * 替代了原来的「拉全部开放任务再在里面找」：开放投票之后那是一次几千条的响应，
 * 只为了用其中一条。
 */
export function getVoteTaskByEntry(entryId: string): Promise<VoteTaskDetail> {
  return request(`/api/vote/entry/${encodeURIComponent(entryId)}`)
}

export type VoteGame = { id: string; name: string; aliases: string[]; kind?: 'game' | 'tag' }

let gamesCache: Promise<VoteGame[]> | null = null

/**
 * 可选游戏与内容标签词库，整页共用一份。
 *
 * 不从构建期烤入的数据里读：服务端认的是数据库快照，两份在「公开仓加了新游戏
 * 但快照还没导入」的窗口期会不一致，用户会遇到「选得中、提交不了」。
 *
 * 失败时把缓存清掉，让下一次打开重新试——否则一次网络抖动会让搜索框
 * 在整个会话里永久空着。
 */
export function listVoteGames(): Promise<VoteGame[]> {
  if (!gamesCache) {
    gamesCache = request<{ games: VoteGame[] }>('/api/vote/games')
      .then((result) => result.games)
      .catch((error) => {
        gamesCache = null
        throw error
      })
  }
  return gamesCache
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
