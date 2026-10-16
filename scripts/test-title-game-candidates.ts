import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findTitleGameCandidates } from './audit/title-game-candidates'

const games = [
  { id: 'portal', name: '传送门', aliases: ['Portal', '传送门1'] },
  { id: 'portal-2', name: '传送门2', aliases: ['Portal 2'] },
  { id: 'work-a', name: '作品甲', aliases: ['互动游戏', '共用词'] },
  { id: 'work-b', name: '作品乙', aliases: ['共用词'] },
]
const run = (title: string, tags: string[] = []) => findTitleGameCandidates([{ id: 'entry', title, games: tags }], games)

test('retains substring leads but marks them as covered by an existing game', () => {
  assert.deepEqual(run('今天玩传送门2', ['portal-2']), [{
    entryId: 'entry', title: '今天玩传送门2', gameId: 'portal', matched: '传送门',
    reviewReason: 'covered-by-tagged-game', relatedGameIds: ['portal-2'],
  }])
})
test('separate mentions remain actionable even when the first occurrence is covered', () => {
  assert.equal(run('传送门2，然后传送门', ['portal-2'])[0].reviewReason, 'name-match')
  assert.equal(run('传送门2，然后传送门1', ['portal-2'])[0].reviewReason, 'alias-only')
})
test('distinguishes names, broad aliases and shared dictionary terms', () => {
  assert.equal(run('作品甲')[0].reviewReason, 'name-match')
  assert.equal(run('互动游戏')[0].reviewReason, 'alias-only')
  const shared = run('共用词')
  assert.equal(shared.length, 2)
  assert.ok(shared.every((item) => item.reviewReason === 'shared-term'))
  assert.deepEqual(shared[0].relatedGameIds, ['work-b'])
})
test('normalizes full-width Latin text and respects single-word boundaries', () => {
  assert.equal(run('ＰＯＲＴＡＬ')[0].gameId, 'portal')
  assert.equal(run('portals').length, 0)
  assert.equal(run('portal3').length, 0)
  assert.equal(run('Portal 2', ['portal-2'])[0].reviewReason, 'covered-by-tagged-game')
})
test('does not confuse an equal shared term with a longer tagged name', () => {
  assert.equal(run('共用词', ['work-b'])[0].reviewReason, 'shared-term')
})
test('prioritizes names ahead of aliases and overlapping leads without deleting leads', () => {
  assert.deepEqual(run('传送门2 互动游戏 作品乙', ['portal-2']).map((item) => item.reviewReason),
    ['name-match', 'alias-only', 'covered-by-tagged-game'])
})
test('never reports already tagged games or empty/single-character terms', () => {
  assert.equal(run('传送门', ['portal']).length, 0)
  assert.deepEqual(findTitleGameCandidates([{ id: 'e', title: '任意内容', games: [] }], [
    { id: 'g', name: '', aliases: [' ', '任'] },
  ]), [])
})
