/**
 * 游戏搜索框的匹配测试，跑在**真实的 587 条词库**上而不是几条假数据。
 *
 * 为什么坚持用真数据：这段逻辑的失败方式不是抛错，是"搜不到"。
 * 假数据里怎么写都能过，只有真词库才会暴露「中文名和英文别名混排时谁在前」
 * 「标点写法不一致」这类实际会发生的情况。
 *
 * 搜不到的代价不是零：用户会转去填自由文本，那要人工处理一遍，
 * 而如果搜到了就是一个能直接落盘的 game id。
 */

import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import { searchGames } from '../src/lib/vote-search'
import type { VoteGame } from '../src/lib/vote-api'

type RawGame = { id: string; name: string; aliases?: string[] }

const raw = yaml.load(
  fs.readFileSync(path.join(process.cwd(), 'data/games.yaml'), 'utf8'),
) as RawGame[]

const games: VoteGame[] = raw.map((game) => ({
  id: game.id,
  name: game.name,
  aliases: game.aliases ?? [],
}))

let failures = 0
function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ok   ${label}`)
  } else {
    failures += 1
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function ids(keyword: string): string[] {
  return searchGames(games, keyword).map((game) => game.id)
}

console.log(`词库共 ${games.length} 条\n`)
console.log('— 基本命中 —')

check('中文名可搜', ids('冰与火之舞').includes('a-dance-of-fire-and-ice'))
check('英文名可搜', ids('Minecraft').length > 0 || ids('slay the spire').length > 0)
check('id 可搜', ids('slay-the-spire-2').includes('slay-the-spire-2'))
check('大小写无关', ids('SLAY THE SPIRE').length === ids('slay the spire').length)

console.log('\n— 别名与标点 —')
// games.yaml 里 1-2-Switch 的别名同时写了「1,2switch」和「12switch」两种标点，
// 说明现实里人就是会用不同写法打同一个名字。
check('别名可搜', ids('12switch').includes('1-2-switch'))
check('别名里的逗号写法也能搜到', ids('1,2switch').includes('1-2-switch'))
check('用户少打了标点也能搜到', ids('1 2 switch').includes('1-2-switch'))
check('程序员升职记（中文名）', ids('程序员升职记').includes('7-billion-humans'))
check('7 Billion Humans（英文别名）', ids('7billionhumans').includes('7-billion-humans'))

console.log('\n— 排序 —')
{
  // 前缀命中必须排在包含命中前面，否则用户打全了名字，
  // 想要的那条反而被一堆「名字里含这几个字」的挤到下面。
  const result = searchGames(games, '塞尔达')
  if (result.length > 1) {
    const first = result[0]
    check(
      '前缀命中排在包含命中之前',
      [first.name, first.id, ...first.aliases].some((value) =>
        value.toLowerCase().replace(/[\s,._:-]/g, '').startsWith('塞尔达'),
      ),
      `首条是 ${first.name}`,
    )
  } else {
    check('前缀命中排在包含命中之前（词库中匹配不足，跳过）', true)
  }
}

console.log('\n— 边界 —')
check('空关键词不返回任何结果', ids('').length === 0)
check('纯空白不返回任何结果', ids('   ').length === 0)
check('纯标点不返回任何结果（归一化后为空）', ids('---').length === 0)
check('搜不到的返回空数组', ids('这个游戏一定不存在zzzz').length === 0)
check('结果条数有上限', searchGames(games, 'a').length <= 24)
check('结果不重复', new Set(ids('a')).size === ids('a').length)

console.log('\n— 不会崩 —')
// 搜索框的内容是用户随便打的，这里塞的都是能让不小心写的正则挂掉的输入。
for (const nasty of ['(', '[', '\\', '.*', '$^', '((((', '?', '+', '{2,}']) {
  try {
    searchGames(games, nasty)
    check(`正则元字符不当成正则：${JSON.stringify(nasty)}`, true)
  } catch (error) {
    check(`正则元字符不当成正则：${JSON.stringify(nasty)}`, false, String(error))
  }
}

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 条未通过`)
process.exit(failures === 0 ? 0 : 1)
