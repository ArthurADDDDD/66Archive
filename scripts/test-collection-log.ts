import assert from 'node:assert/strict'
import { collectionTimestamp, parseCollectionLogPage } from '../src/lib/collection-log'

const item = { id: '2026-10-12-live-01', type: 'live', title: '测试录播', contentDate: '2026-10-12', recordedAt: '2026-10-13T17:02:03.000Z', href: '/e/2026-10-12-live-01/' }
assert.equal(collectionTimestamp(item.recordedAt), '2026.10.14 01:02:03', '显式北京时间，保留秒，正确跨日')
assert.deepEqual(parseCollectionLogPage({items:[item],nextCursor:null}),{items:[item],nextCursor:null})
for(const bad of [ {...item,recordedAt:'2026-10-13'}, {...item,recordedAt:'invalid'}, {...item,href:'https://example.test'}, {...item,contentDate:'yesterday'} ]) assert.equal(parseCollectionLogPage({items:[bad],nextCursor:null}),null)
assert.equal(parseCollectionLogPage({items:Array(31).fill(item),nextCursor:null}),null)
assert.equal(parseCollectionLogPage({items:[],nextCursor:'../../private'}),null)
console.log('✓ 收录日志：北京时间与秒精度、接口形状、站内链接、非法时间/游标拒绝')
