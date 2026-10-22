/** 已有可播放互补源与缺乏可用录像/证据必须分开登记。 */
export type GapStatus = 'playable_complement' | 'source_unverified' | 'no_known_replay' | 'evidence_insufficient'

export type ReviewedGap = {
  entry: string
  games: string[]
  status: GapStatus
  reason: string
}

/** partial / unknown 覆盖下，按具体游戏区分已有可播放录像、链接受阻与真实缺源。 */
export const REVIEWED_GAPS: ReviewedGap[] = [
  {
    entry: '2025-06-10-live-04',
    games: ['dune-awakening'],
    status: 'no_known_replay',
    reason: '同场先玩无主星渊、后体验沙丘：觉醒（直播间标题与合并备注）；现有三份搬运录像（BV1eDM3z4EAa / BV1phM3zgEJb / BV1jyM3zaEyZ，约 104 分钟）经维护者人工核对全是无主星渊，沙丘段录像缺失，待后续补找。',
  },
  {
    entry: '2017-07-12-live-01',
    games: ['kindergarten'],
    status: 'no_known_replay',
    reason: 'Kindergarten 只见于贴吧同期记录与节目单；基准 B站 BV1Bx411q7iU 页 1 经维护者人工核对为纯聊天、页 2 为 Crossout，没有其它录像来源。',
  },
  {
    entry: '2015-11-15-live-01',
    games: ['rise-of-the-tomb-raider'],
    status: 'source_unverified',
    reason: '基准 B站 BV1ef4y1Y7T2?p=16 只含《心灵砒霜-20151115》；《古墓丽影：崛起》上午段的唯一线索是贴吧截图中的网盘分享（文件「古墓丽影10-2.flv」，分享者 gijj1986），分享已失效，未能核对内容。',
  },
  {
    entry: '2016-03-09-live-01',
    games: ['nixizhixingtu-shanyao'],
    status: 'no_known_replay',
    reason: '基准 B站 BV1Xx411V7mT P1+P2 与 A站 ac2592025 逐段对齐，全程只有星露谷；「逆袭之星途闪耀」段录像小屋未补投，B 站与优酷检索也未找到，标 missing_footage。',
  },
  {
    entry: '2016-03-28-live-01',
    games: ['geometry-dash'],
    status: 'no_known_replay',
    reason: 'Geometry Dash 只见于贴吧同期记录与节目单，没有可用录像来源；基准 B站 BV1fW411i7Lr 的 P3–P4 只含星露谷（四张缩略图样本），未能完全排除页内短段。',
  },
  {
    entry: '2019-07-04-live-01',
    games: ['human-fall-flat'],
    status: 'no_known_replay',
    reason: '唱歌与《人类：一败涂地》MOD 两段在 B站 BV1Pt411n7qY 中都不存在（该录像只含 Online）；条目 note 写 B站 / AcFun / YouTube 全站检索均未找到公开录像，待私人存档补档。',
  },
  {
    entry: '2022-01-26-live-01',
    games: ['majsoul'],
    status: 'source_unverified',
    reason: 'basis B站 BV1pP4y1N74S 单 P 10345 秒只录了文字游戏；条目 288 分钟，雀魂部分可能在 A 站 ac33384977 / ac33385054，未核对内容。',
  },
  {
    entry: '2015-01-27-live-01',
    games: ['i-wanna-be-the-xylem'],
    status: 'playable_complement',
    reason: 'A站 ac1708393 片头画面证实 I Wanna，来源可播放；主 basis ac1733926 为《超级马里奥3D世界》。',
  },
  {
    entry: '2015-01-29-live-01',
    games: ['im-scared', 'super-mario-3d-world', 'rhythm-heaven', 'just-dance'],
    status: 'source_unverified',
    reason: '基准 B 站单 P 仅 19:36；两条优酷来源只返回反爬/跳转页，未能确认可播放与分 P，标签保留。',
  },
  {
    entry: '2015-07-06-live-01',
    games: ['minecraft'],
    status: 'no_known_replay',
    reason: '唯一来源是 198 秒片段，只含 Besiege；Minecraft 不在该片段内。',
  },
  {
    entry: '2016-01-04-live-02',
    games: ['banished', 'papers-please'],
    status: 'playable_complement',
    reason: '基准 ac2440577 只覆盖《命运交叉的客店》；ac2440642 片头抽帧为 Banished，ac2441013 片头抽帧为 Papers, Please，两条均可播放。',
  },
  {
    entry: '2016-02-20-live-01',
    games: ['rusty-lake'],
    status: 'evidence_insufficient',
    reason: '基准为完整街霸 5 录像；抽帧 1:00 / 1:00:00 / 2:00:00 / 2:13:20 均为街霸 5 与分享菜单，未见生锈小湖。',
  },
  {
    entry: '2016-08-17-live-03',
    games: ['starbound', 'overwatch'],
    status: 'playable_complement',
    reason: '基准 B 站 P1 只含难死塔；A站 ac3029701 的 P1/P2 为星界边境、ac3029731 的 P1/P2 为守望先锋，均从各自视频片头开始。',
  },
  {
    entry: '2017-01-18-live-01',
    games: ['reigns-classic'],
    status: 'playable_complement',
    reason: '基准 B 站只有 P1/P2（几何冲刺）；A站 ac3415701 的 P1/P2 均为王权，从视频片头开始。',
  },
  {
    entry: '2017-02-17-live-01',
    games: ['kalimba'],
    status: 'evidence_insufficient',
    reason: '基准三 P 的旧分段均为几何冲刺，未找到 Kalimba 的画面或分 P 标题证据。',
  },
  {
    entry: '2017-04-04-live-01',
    games: ['super-bomberman-r', 'zelda-botw'],
    status: 'playable_complement',
    reason: '基准只有 P1（12Switch）；A站 ac3601511 片头为超级炸弹人R，ac3601510 的 P1/P2 为塞尔达，均从视频片头开始。',
  },
  {
    entry: '2022-11-02-live-01',
    games: ['the-past-within'],
    status: 'playable_complement',
    reason: 'A站 ac39540914（23395s）含 Endoparasitic → The Past Within；The Past Within 约 17180s（4:46:20）开始，可播放。A站无秒级 URL 参数，精确跳转需来源覆盖/结构方案。',
  },
  {
    entry: '2023-09-17-live-01',
    games: ['party-animals'],
    status: 'playable_complement',
    reason: 'A站 ac42398567（P2，19499s）约 250s–2550s 为猛兽派对，随后切回匹诺曹的谎言；它是一条独立视频，A站只能跳到分P开头。',
  },
  {
    entry: '2023-11-09-live-01',
    games: ['magicraft'],
    status: 'playable_complement',
    reason: 'A站 ac42909912（P1，11285s）约 1790s–3870s 为魔法工艺，之后是鹅鹅鸭；它是一条独立视频，A站只能跳到分P开头。',
  },
]
