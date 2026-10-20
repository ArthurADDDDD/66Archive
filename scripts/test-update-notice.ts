import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SITE_UPDATES, ARCHIVE_UPDATES } from '../src/lib/site-updates'
import { HISTORICAL_FEATURE_UPDATES, HISTORICAL_ARCHIVE_UPDATES } from '../src/lib/curated-update-history'
import { UPDATE_COPY_TEXTS, updateCopyId } from '../src/lib/update-copy'
import {
  getUpdateNotice,
  getUpdateHistory,
  shouldShowUpdateNotice,
  type VisitorUpdate,
} from '../src/lib/update-notice'

const updates: VisitorUpdate[] = [
  { date: '2026-10-19', source: 'feature-2', title: '新版游戏定位', text: '已开放', tags: ['游戏', '录像'] },
  { date: '2026-10-12', source: 'feature-1', title: '邮件提醒', text: '已开放', tags: ['提醒', '录像'] },
  { date: '2026-09-20', source: 'feature-0', title: '画廊更新', text: '已开放', tags: ['画廊'] },
  { date: '2026-09-18', source: 'too-old', title: '旧更新', text: '不展示' },
]

const today = new Date(2026, 9, 19)
const notice = getUpdateNotice(today, updates)
assert.ok(notice)
assert.equal(notice.version, '2026-10-19:feature-2')
assert.equal(notice.updates.length, 3, '一次聚合近 30 天的多个功能')
assert.deepEqual(notice.tags, ['游戏', '录像', '提醒', '画廊'], '标签合并去重')
assert.equal(shouldShowUpdateNotice(null, notice), true, '首次访问显示')
assert.equal(shouldShowUpdateNotice(notice.version, notice), false, '同版本重复访问不再显示')

const next = getUpdateNotice(new Date(2026, 9, 20), [
  { date: '2026-10-20', source: 'feature-3', title: '下一版功能', text: '已开放' },
  ...updates,
])
assert.ok(next)
assert.equal(shouldShowUpdateNotice(notice.version, next), true, '发布新的功能日志后再次提示')

assert.equal(getUpdateNotice(new Date(2026, 11, 5), [
  { date: '2026-10-19', source: 'old', title: '旧公告', text: '过期' },
]), null, '一个多月没有新功能时，不把陈年日志当成新消息')

assert.equal(getUpdateNotice(today, [
  { date: '2026-10-99', title: '错误日期', text: '无效' },
  { date: '2026-08', title: '月份摘要', text: '非完整日期' },
]), null, '无效和月份级日期不能成为公告')

// The complete history must include both types and never inherit the 30-day cutoff.
const history = getUpdateHistory(
  [
    { date: '2026-10-19', title: '本月功能', text: '现在' },
    { date: '2026-08', title: '建站', text: '最早记录' },
  ],
  [
    { date: '2026-10-18', title: '近期补档', text: '录播' },
    { date: '2026-08-10', title: '老补档', text: '仍可查看' },
  ],
)
assert.equal(history.length, 4, '全部历史应同时包含功能与补档')
assert.deepEqual(history.map((entry) => entry.title), ['本月功能', '近期补档', '老补档', '建站'], '历史记录按日期从新到旧')
assert.deepEqual(history.map((entry) => entry.category), ['功能', '收录', '收录', '功能'])


// Full history page and notification stay discoverable without changing
// the storage version or placing music controls on /updates/.
const completeHistory = getUpdateHistory()
const expectedFeatureCount = SITE_UPDATES.length + HISTORICAL_FEATURE_UPDATES.length
const expectedArchiveCount = ARCHIVE_UPDATES.length + HISTORICAL_ARCHIVE_UPDATES.length
assert.ok(HISTORICAL_FEATURE_UPDATES.length >= 35 && HISTORICAL_ARCHIVE_UPDATES.length >= 15, '历史不能只剩少数几条')
assert.equal(completeHistory.filter(item => item.category === '功能').length, expectedFeatureCount)
assert.equal(completeHistory.filter(item => item.category === '收录').length, expectedArchiveCount)
const ids = new Set<string>()
for (const [kind, entries] of [
  ['feature', [...SITE_UPDATES, ...HISTORICAL_FEATURE_UPDATES]],
  ['archive', [...ARCHIVE_UPDATES, ...HISTORICAL_ARCHIVE_UPDATES]],
] as const) {
  for (const entry of entries) {
    assert.ok(/^2026-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12][0-9]|3[01]))?$/.test(entry.date), `更新日期异常: ${entry.date}`)
    assert.ok(entry.title.trim().length > 0 && entry.text.trim().length > 0)
    for (const field of ['title', 'text'] as const) {
      const id = updateCopyId(kind, entry, field)
      assert.ok(!ids.has(id), `文案稳定 ID 重复: ${id}`)
      ids.add(id)
    }
  }
}
assert.equal(UPDATE_COPY_TEXTS.length, ids.size, '每条更新的标题与说明都要登记到后台文案系统')
assert.ok(UPDATE_COPY_TEXTS.every(item => ids.has(item.id)), '不能存在重复或无法绑定的旧文案')
assert.equal(
  getUpdateNotice(new Date(2026, 9, 20))?.version,
  `${SITE_UPDATES[0].date}:${SITE_UPDATES[0].source}`,
  '增补历史记录不得改变公告最新版本',
)
assert.equal(
  getUpdateNotice(new Date(2026, 9, 20))?.updates.length,
  SITE_UPDATES.filter(item => item.date >= '2026-09-20' && item.date <= '2026-10-20').length,
  '历史增补不能加进仅展示近期变化的弹窗',
)
assert.equal(completeHistory.length, expectedFeatureCount + expectedArchiveCount)
assert.deepEqual(
  completeHistory.map(item => item.date),
  [...completeHistory.map(item => item.date)].sort((a, b) => b.localeCompare(a)),
  'all history remains newest first',
)
assert.match(readFileSync('src/app/updates/page.tsx', 'utf8'), /getUpdateHistory\(\)/)
assert.match(readFileSync('src/components/UpdateNotice.tsx', 'utf8'), /target="_blank"/)
assert.match(readFileSync('src/components/UpdateNotice.tsx', 'utf8'), /aria-modal=\{mobile \? true : undefined\}/)
assert.match(readFileSync('src/components/BgmPlayer.tsx', 'utf8'), /pathname === '\/updates'/)
assert.match(readFileSync('src/components/primitives.tsx', 'utf8'), /href="\/updates\/"/)
assert.match(readFileSync('src/app/sitemap.ts', 'utf8'), /'\/updates\/'/)

console.log('visitor update notice: recent and full history, discoverability, silent route and once-only assertions passed')
