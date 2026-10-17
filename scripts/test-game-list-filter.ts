/**
 * 录播室筛选面板「在游戏列表中查找」的匹配测试，跑在真实词库上。
 *
 * 这段逻辑失败时不报错，只表现为「列表里明明有，就是找不到」，或者查找之后顺序乱了、
 * 让人以为场次最多的那几款不见了。所以这里只测这两件会被用户直接感受到的事。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import { filterGameList } from '../src/lib/game-list-filter'

type RawGame = { id: string; name: string }
const raw = yaml.load(fs.readFileSync(path.join(process.cwd(), 'data/games.yaml'), 'utf8')) as RawGame[]
// 和录播室载荷同形：只有 id、显示名和场次；场次倒序是面板的原始顺序。
const list = raw.map((game, index) => ({ id: game.id, name: game.name, count: raw.length - index }))

const byName = (name: string) => {
  const game = raw.find((item) => item.name === name)
  assert.ok(game, `词库里应当有《${name}》，测试样例需要更新`)
  return game
}

// 空查找词（含只有空格）原样返回整份列表，不是空列表。
assert.equal(filterGameList(list, '').length, list.length)
assert.equal(filterGameList(list, '   ').length, list.length)

// 中文名片段能找到。
const stardew = byName('星露谷物语')
assert.ok(filterGameList(list, '星露谷').some((game) => game.id === stardew.id), '「星露谷」应当找到《星露谷物语》')

// 查找结果保持原来的场次顺序，不按名称重排。
const multi = filterGameList(list, '传说')
assert.ok(multi.length > 1, '「传说」应当命中不止一款，否则顺序测不出来')
for (let index = 1; index < multi.length; index++) assert.ok(multi[index - 1].count > multi[index].count, '查找结果应保持场次倒序')

// 大小写、空格与标点不影响：拿一个带 ASCII 的名字，大写并去掉空格 / 标点再查。
const ascii = raw.find((game) => /[a-z].*[\s:.\-,_]/i.test(game.name))
assert.ok(ascii, '词库里应当有带英文与标点的游戏名')
const mangled = ascii.name.toUpperCase().replace(/[\s:.\-,_]/g, '')
assert.ok(filterGameList(list, mangled).some((game) => game.id === ascii.id), `「${mangled}」应当找到《${ascii.name}》`)

// 游戏 id 也认：名字是中文、id 是拼写时，按 id 片段也能找到。
const byId = raw.find((game) => !/[a-z]/i.test(game.name) && /^[a-z0-9-]{4,}$/.test(game.id))
assert.ok(byId, '词库里应当有中文名 + 英文 id 的游戏')
assert.ok(filterGameList(list, byId.id).some((game) => game.id === byId.id))

// 不存在的词不命中任何一款，面板据此显示「没有匹配」。
assert.equal(filterGameList(list, '这个词不应该出现在任何游戏名里zzqx').length, 0)

console.log(`game list filter: ${list.length} 款游戏上的查找全部通过`)
