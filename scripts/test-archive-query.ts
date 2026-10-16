import assert from 'node:assert/strict'
import { readArchiveQuery, writeArchiveQuery } from '../src/lib/archive-query'
const years = [2026, 2015]
const months = (year: number) => year === 2015 ? [4, 5] : [10]
const filters = { q: '传送门 & Portal / 2', platforms: ['douyu', 'bilibili'], types: ['live'], games: ['portal-2'], onlyAlive: true }
assert.deepEqual(readArchiveQuery(writeArchiveQuery(filters, 2015, 4, 2026), years, months), { year: 2015, month: 4, filters })
const empty = { q: '', platforms: [], types: [], games: [], onlyAlive: false }
assert.equal(writeArchiveQuery(empty, 2026, null, 2026), '')
assert.deepEqual(readArchiveQuery('', years, months), { year: 2026, month: null, filters: empty })
assert.deepEqual(readArchiveQuery('?y=1900&m=4', years, months), { year: 2026, month: null, filters: empty })
assert.equal(readArchiveQuery('?y=2015&m=13', years, months).month, null)
assert.equal(readArchiveQuery('?y=2015&m=4', years, months).month, 4)
assert.equal(readArchiveQuery('?q=%E4', years, months).filters.q, '�')
assert.deepEqual(readArchiveQuery('?p=,douyu,,&alive=0', years, months).filters.platforms, ['douyu'])
console.log('✓ Archive query round-trip, cleared history state, invalid dates and encoded search')
