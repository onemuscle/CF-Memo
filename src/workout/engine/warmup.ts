// ウォームアップ (4分) とクールダウンのストレッチ (2分)。合計6分。
// その日に使う部位に合わせて、動的ストレッチと静的ストレッチを選ぶ。

import { COOLDOWN_SEC, WARMUP_SEC } from './common'
import { pick, shuffle, type Rng } from './rng'
import type { Block, Env, Injury, Item, Muscle } from './types'

interface Drill {
  id: string
  name: string
  prescription: string
  avoid?: Injury[]
  cue?: string
  /** 初めての人向けの手順 */
  steps?: string[]
}

const UPPER: Drill[] = [
  { id: 'arm-circle', name: 'アームサークル', prescription: '前後 各10回', cue: '小さい円から大きい円へ', steps: ['両腕を横に伸ばし、肩の高さまで上げる', '指先で小さな円を描き、少しずつ大きくしていく', '前回し10回のあと、後ろ回し10回'] },
  { id: 'cat-cow', name: 'キャット&カウ', prescription: '8回', avoid: ['wrist'], cue: '背骨を1つずつ動かすイメージ', steps: ['四つ這いになる (手は肩の真下・膝は股関節の真下)', '息を吐きながら背中を丸め、おへそをのぞき込む', '息を吸いながら背中を反らし、胸を前へ。ゆっくり交互に'] },
  { id: 'scap-pushup', name: 'スキャプラ・プッシュアップ', prescription: '10回', avoid: ['wrist'], cue: '肘は伸ばしたまま肩甲骨だけを寄せて開く', steps: ['腕立て伏せの姿勢になる (きつければ膝をつく)', '肘は伸ばしたまま、胸を少し沈めて肩甲骨を寄せる', '床を押して背中を丸め、肩甲骨を開く'] },
  { id: 'wall-slide', name: 'ウォールスライド', prescription: '10回', cue: '壁に背中と腕をつけたまま腕を上下', steps: ['壁に背中・お尻・頭をつけて立つ', '腕をバンザイの形にして、肘と手の甲を壁につける', '壁から離さないまま、腕をゆっくり上下させる'] },
  { id: 'thread-needle', name: 'スレッド・ザ・ニードル', prescription: '左右 各5回', avoid: ['wrist'], cue: '四つ這いで腕を体の下に通して胸をひねる', steps: ['四つ這いになる', '片手を反対側の手と膝の間に通し、肩と頬を床へ近づける', '戻すときにその腕を天井へ伸ばし、胸を開く'] },
  { id: 'band-pa', name: 'バンドプルアパート', prescription: '15回', cue: 'バンドがなければタオルで', steps: ['バンド (なければタオル) を肩幅で持ち、腕を前に伸ばす', '肩甲骨を寄せながら、胸の前で左右に引き開く', '肩がすくまないように、ゆっくり戻す'] },
]

const LOWER: Drill[] = [
  { id: 'leg-swing', name: 'レッグスイング', prescription: '前後・左右 各10回', cue: '壁に手をついて股関節を大きく振る', steps: ['壁や柱に手をついて片脚で立つ', '反対の脚を前後に大きく振る (10回)', '続けて体の前で左右に振る (10回)。終わったら反対の脚も'] },
  { id: 'wgs', name: 'ワールドグレイテスト・ストレッチ', prescription: '左右 各3回', avoid: ['knee', 'wrist'], cue: 'ランジ姿勢から肘を床へ、胸を開いて天井へ', steps: ['大きく一歩踏み出して、ランジの姿勢になる', '前足の内側に手をつき、反対の肘を床へ近づける', 'その腕を天井へ伸ばして胸を開く。反対側も'] },
  { id: '90-90', name: '90/90 ヒップスイッチ', prescription: '左右 各5回', cue: '座って両膝を90度に曲げ、左右に倒す', steps: ['床に座り、両膝を90度に曲げて同じ方向へ倒す', '手を後ろについて、上体は起こしたまま', '両膝をゆっくり反対側へ倒す。股関節が回るのを感じる'] },
  { id: 'glute-bridge-wu', name: 'グルートブリッジ', prescription: '12回', cue: 'お尻を締めて2秒キープ', steps: ['仰向けで膝を立てる (足は腰幅)', 'かかとで床を押して、お尻を持ち上げる', '肩から膝が一直線になったら2秒止めて、ゆっくり下ろす'] },
  { id: 'ankle-rock', name: 'アンクルロッキング', prescription: '左右 各10回', cue: '膝をつま先の先へ倒して足首をほぐす', steps: ['片膝立ちになり、前足のかかとを床につける', 'かかとを浮かせずに、膝をつま先より前へ倒す', '前後に10回。反対の足も'] },
  { id: 'cossack', name: 'コサックスクワット (浅め)', prescription: '左右 各5回', avoid: ['knee'], cue: '内ももを伸ばしながら左右へ', steps: ['足を大きく開いて立つ', '片方の膝を曲げて腰を落とし、反対の脚は伸ばしたまま', '浅い位置で、左右にゆっくり体重を移す'] },
]

const CORE: Drill[] = [
  { id: 'dead-bug-wu', name: 'デッドバグ', prescription: '左右 各5回', cue: '腰を床に押し付けたまま', steps: ['仰向けで腕を天井へ伸ばし、膝を90度に曲げて持ち上げる', '腰を床に押し付けたまま、右腕と左脚をゆっくり伸ばす', '元に戻して反対側。腰が浮くなら動きを小さく'] },
  { id: 'bird-dog', name: 'バードドッグ', prescription: '左右 各6回', avoid: ['wrist'], cue: '四つ這いで対角の手足を伸ばす', steps: ['四つ這いになる', '右腕と左脚を、体と一直線になるまで伸ばす', '2秒止めて戻し、反対側。腰を反らさない'] },
]

/** 心拍を上げる最初の1分 */
function cardioDrill(env: Env, injuries: Injury[], quiet: boolean, rng: Rng): Item {
  const knee = injuries.includes('knee')
  const options =
    env === 'box'
      ? ['ロー (ローイング)', 'エアバイク', 'ロー (ローイング)']
      : env === 'home'
        ? quiet || knee
          ? ['その場足踏み + 腕回し']
          : ['その場足踏み + 腕回し', 'ジャンピングジャック']
        : env === 'outdoor'
          ? knee
            ? ['早歩き']
            : ['軽いジョグ', '早歩き → 軽いジョグ']
          : knee
            ? ['エアロバイク']
            : ['エアロバイク', 'トレッドミル早歩き', 'クロストレーナー']
  return {
    id: 'wu-cardio',
    name: pick(rng, options),
    prescription: '60秒',
    detail: '会話できる強度から、最後の15秒だけ少し速く',
    seconds: 60,
  }
}

const UPPER_MUSCLES: Muscle[] = ['chest', 'back', 'shoulders', 'arms']
const LOWER_MUSCLES: Muscle[] = ['legs', 'glutes']

function region(focus: Muscle[]): 'upper' | 'lower' | 'both' {
  const up = focus.some(m => UPPER_MUSCLES.includes(m))
  const low = focus.some(m => LOWER_MUSCLES.includes(m))
  if (up && !low) return 'upper'
  if (low && !up) return 'lower'
  return 'both'
}

function choose(rng: Rng, pool: Drill[], injuries: Injury[], n: number, taken: Set<string>): Drill[] {
  const ok = shuffle(rng, pool).filter(d => !taken.has(d.id) && !(d.avoid ?? []).some(i => injuries.includes(i)))
  const out = ok.slice(0, n)
  out.forEach(d => taken.add(d.id))
  return out
}

function drillItem(d: Drill, seconds: number): Item {
  return { id: `wu-${d.id}`, name: d.name, prescription: d.prescription, detail: d.cue, cues: d.steps, seconds }
}

export function buildWarmup(opts: {
  env: Env
  focus: Muscle[]
  injuries: Injury[]
  quiet?: boolean
  rng: Rng
  /** 最初に行うメイン種目 (軽い重さで動きを確認する) */
  firstMain?: string
}): Block {
  const { env, focus, injuries, rng, firstMain, quiet = false } = opts
  const taken = new Set<string>()
  const r = region(focus)
  const mobility =
    r === 'upper'
      ? choose(rng, UPPER, injuries, 2, taken)
      : r === 'lower'
        ? choose(rng, LOWER, injuries, 2, taken)
        : [...choose(rng, LOWER, injuries, 1, taken), ...choose(rng, UPPER, injuries, 1, taken)]
  if (focus.includes('core') && mobility.length > 1) mobility[1] = choose(rng, CORE, injuries, 1, taken)[0] ?? mobility[1]

  const items: Item[] = [cardioDrill(env, injuries, quiet, rng), ...mobility.map(d => drillItem(d, 45))]

  // 最後の90秒: 今日の動きに近い活性化 + メイン種目の確認
  const activation = choose(rng, r === 'upper' ? [...UPPER, ...CORE] : [...LOWER, ...CORE], injuries, 1, taken)[0]
  if (activation) items.push(drillItem(activation, 45))
  items.push({
    id: 'wu-ramp',
    name: firstMain ? `${firstMain} (軽めで動作確認)` : 'インチワーム + エアスクワット',
    prescription: firstMain ? '5〜10回' : '5回 + 10回',
    detail: firstMain
      ? env === 'home' || env === 'outdoor'
        ? '今日のメイン種目を、浅め・ゆっくりで動きを確認'
        : '今日いちばん重い種目を、軽い負荷 (空のバー・軽いダンベル・補助付き) で'
      : '全身をつなげて動かす',
    seconds: WARMUP_SEC - items.reduce((s, i) => s + (i.seconds ?? 0), 0),
  })

  return {
    key: 'warmup',
    kind: 'warmup',
    label: 'WARM UP',
    title: 'ウォームアップ',
    minutes: WARMUP_SEC / 60,
    format: '体温を上げる → 今日使う関節を動かす → メインの動きを確認、の順で4分',
    items,
    timer: { type: 'guided', steps: items.map(i => ({ label: i.name, seconds: i.seconds ?? 30 })) },
  }
}

interface Stretch {
  id: string
  name: string
  seconds: number
  each?: boolean
  avoid?: Injury[]
  cue: string
  /** 初めての人向けの手順 */
  steps?: string[]
}

const STRETCHES: Record<Muscle, Stretch[]> = {
  chest: [{ id: 'st-chest', name: '胸のストレッチ (壁・柱に手をついて体をひねる)', seconds: 20, each: true, cue: '肩の高さで手をつき、反対側へ胸を開く', steps: ['壁や柱の横に立ち、手のひらを肩の高さでつける', 'そのまま体を反対側へゆっくりひねる', '胸の前が伸びたところで止め、呼吸を続ける'] }],
  back: [
    { id: 'st-child', name: 'チャイルドポーズ', seconds: 30, cue: '正座からお尻をかかとに乗せたまま腕を前へ', steps: ['正座から、両手を前の床につく', 'お尻をかかとに乗せたまま、腕をできるだけ前へ滑らせる', 'おでこを床に近づけて、背中全体を伸ばす'] },
    { id: 'st-lat', name: '広背筋ストレッチ (柱をつかんでお尻を引く)', seconds: 15, each: true, cue: '脇の下が伸びるのを感じる', steps: ['柱や手すりを片手でつかむ', 'つかんだままお尻を後ろへ引き、上体を倒す', '脇の下から背中が伸びるのを感じる'] },
  ],
  shoulders: [{ id: 'st-xbody', name: 'クロスボディ・ショルダーストレッチ', seconds: 15, each: true, cue: '腕を胸の前で反対の腕で抱える', steps: ['片腕を胸の前に伸ばす', '反対の腕で肘のあたりを抱え、体へ引き寄せる', '肩がすくまないようにして、肩の後ろを伸ばす'] }],
  arms: [
    { id: 'st-tri', name: '二の腕のストレッチ', seconds: 15, each: true, cue: '肘を頭の後ろで反対の手で引く', steps: ['片腕を上げて肘を曲げ、手を背中側へ', '反対の手で肘をつかみ、頭の後ろへゆっくり引く', '二の腕の裏が伸びたところで止める'] },
    { id: 'st-forearm', name: '前腕のストレッチ', seconds: 10, each: true, avoid: ['wrist'], cue: '腕を前に伸ばし手のひらを反らす', steps: ['腕を前にまっすぐ伸ばし、手のひらを前へ向ける', '反対の手で指先をつかみ、手前へゆっくり反らす', '前腕の内側が伸びるのを感じる'] },
  ],
  core: [{ id: 'st-cobra', name: 'コブラストレッチ', seconds: 20, avoid: ['lowback'], cue: 'うつ伏せから腕で上体を起こしお腹を伸ばす', steps: ['うつ伏せになり、手を胸の横につく', '腕で床を押して、上体をゆっくり起こす', '腰が痛くない高さで止め、お腹の前を伸ばす'] }],
  glutes: [{ id: 'st-fig4', name: 'お尻のストレッチ (仰向けで脚を4の字に)', seconds: 20, each: true, cue: '膝を胸に引き寄せる', steps: ['仰向けで両膝を立てる', '片方の足首を反対の膝に乗せて「4の字」を作る', '下の脚の太ももを両手で抱え、胸へ引き寄せる'] }],
  legs: [
    { id: 'st-quad', name: '前もものストレッチ (横向きでかかとをお尻へ)', seconds: 15, each: true, avoid: ['knee'], cue: '腰を反らさない', steps: ['横向きに寝て、下の腕を枕にする', '上の脚の足首を持ち、かかとをお尻へ近づける', '腰を反らさずに、太ももの前が伸びるのを感じる'] },
    { id: 'st-ham', name: 'もも裏のストレッチ (片脚を伸ばして前屈)', seconds: 15, each: true, cue: '背中を丸めず、おへそを太ももへ', steps: ['床に座り、片脚を前に伸ばす (反対の脚は曲げる)', '背中を丸めずに、おへそを太ももへ近づけるように前へ倒す', 'もも裏が伸びたところで止める。つま先は天井へ'] },
    { id: 'st-calf', name: 'ふくらはぎのストレッチ (壁を押す)', seconds: 10, each: true, cue: '後ろ足のかかとを床につけたまま', steps: ['壁に両手をつき、片脚を後ろへ引く', '後ろ足のかかとを床につけたまま、前の膝を曲げて壁を押す', 'ふくらはぎが伸びたところで止める'] },
  ],
}

const BREATH: Stretch = { id: 'st-breath', name: '仰向けで深呼吸', seconds: 20, cue: '4秒吸って6秒吐く。心拍を落として終わる', steps: ['仰向けになり、全身の力を抜く', '鼻から4秒かけて吸い、口から6秒かけて吐く', 'お腹がふくらむのを感じながら繰り返す'] }

export function buildCooldown(opts: { focus: Muscle[]; worked: Muscle[]; injuries: Injury[]; rng: Rng }): Block {
  const { focus, worked, injuries, rng } = opts
  // 狙った部位 → その他使った部位 の順に、2分に収まるまで入れる
  const order = [...focus, ...shuffle(rng, worked.filter(m => !focus.includes(m)))]
  const budget = COOLDOWN_SEC - BREATH.seconds
  const picked: Stretch[] = []
  let used = 0
  for (let round = 0; round < 3 && used < budget; round++) {
    for (const m of order) {
      const s = STRETCHES[m].filter(x => !(x.avoid ?? []).some(i => injuries.includes(i)) && !picked.includes(x))[0]
      if (!s) continue
      const cost = s.seconds * (s.each ? 2 : 1)
      if (used + cost > budget) continue
      picked.push(s)
      used += cost
    }
  }
  // 余った時間は最初のストレッチを長めに
  const slack = budget - used
  const items: Item[] = [...picked, BREATH].map((s, i) => {
    const extra = i === 0 ? Math.floor(slack / (s.each ? 2 : 1)) : 0
    const sec = s.seconds + extra
    return {
      id: s.id,
      name: s.name,
      prescription: s.each ? `左右 各${sec}秒` : `${sec}秒`,
      detail: s.cue,
      cues: s.steps,
      seconds: sec * (s.each ? 2 : 1),
    }
  })

  return {
    key: 'cooldown',
    kind: 'cooldown',
    label: 'COOL DOWN',
    title: 'クールダウン・ストレッチ',
    minutes: COOLDOWN_SEC / 60,
    format: '今日使った部位を中心に、反動をつけずにゆっくり伸ばす',
    items,
    timer: {
      type: 'guided',
      steps: items.flatMap(i =>
        i.prescription.startsWith('左右')
          ? [
              { label: `${i.name} (右)`, seconds: (i.seconds ?? 20) / 2 },
              { label: `${i.name} (左)`, seconds: (i.seconds ?? 20) / 2 },
            ]
          : [{ label: i.name, seconds: i.seconds ?? 20 }],
      ),
    },
  }
}
