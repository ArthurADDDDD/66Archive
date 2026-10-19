import assert from 'node:assert/strict'
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

// The in-card history must include both types and never inherit the 30-day cutoff.
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

console.log('visitor update notice: recent and full history, grouped tags, once-only and next-version assertions passed')
