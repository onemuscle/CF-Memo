// CrossFit ボックス向けのメニュー生成。
// クラスと同じく「ストレングス → WOD → 補強」の順に、目的に応じて時間を配分する。
// WOD は種目ごとの1回あたりの秒数から、狙った時間・ラウンド数になるよう回数を逆算する。

import { BOOKEND_MIN, LEVEL_NUM, clamp, niceReps, roundRest, secText, type GenContext } from './common'
import {
  BOX_MOVEMENTS,
  LIFTS,
  WOD_NAMES,
  byScale,
  type BoxMovement,
  type Lift,
  type Modality,
} from './crossfit'
import { GYM_EXERCISES, type GymExercise } from './exercises'
import { easyCardio } from './cardio'
import { injuryCautions } from './gym'
import { musclesText } from './labels'
import { pick, shuffle, weighted, type Rng } from './rng'
import type { Answers, Block, Goal, Item, Muscle, Variant } from './types'

type Format = 'amrap' | 'rounds' | 'ladder' | 'chipper' | 'emom' | 'interval' | 'tabata'

interface Ctx {
  a: Answers
  rng: Rng
  recent: Set<string>
  focus: Muscle[]
  /** 1回あたりの秒数にかける係数 (レベル・体調) */
  pace: number
}

const SPLIT: Record<Goal, [number, number, number]> = {
  strength: [0.45, 0.33, 0.22],
  muscle: [0.33, 0.33, 0.34],
  lean: [0.2, 0.55, 0.25],
  stamina: [0.15, 0.7, 0.15],
  athletic: [0.35, 0.45, 0.2],
  health: [0.3, 0.4, 0.3],
}

export function buildBox(a: Answers, rng: Rng, gen: GenContext) {
  const recent = new Set(Object.keys(gen.used))
  const lvl = LEVEL_NUM[a.level]
  const pace = (lvl === 1 ? 1.35 : lvl === 3 ? 0.85 : 1) * (a.condition === 'tired' ? 1.1 : 1)
  const full = a.focus.length === 0
  const focus: Muscle[] = full ? [] : a.focus
  const ctx: Ctx = { a, rng, recent, focus, pace }

  // ---- 時間配分 ----
  const B = a.minutes - BOOKEND_MIN
  let [s, w, acc] = SPLIT[a.goal]
  if (B < 20) {
    ;[s, w, acc] = a.goal === 'strength' ? [0.6, 0.4, 0] : [0, 1, 0]
  } else if (B < 35) {
    ;[s, w] = [s / (s + w), w / (s + w)]
    acc = 0
  }
  const strengthBudget = Math.round(B * s)
  const accBudget = Math.round(B * acc)

  const blocks: Block[] = []
  const ids: string[] = []
  const worked = new Set<Muscle>()
  const why: string[] = []

  let lift: Lift | undefined
  let strengthMin = 0
  if (strengthBudget >= 8) {
    lift = pickLift(ctx, gen)
    if (lift) {
      const sb = strengthBlock(lift, a, strengthBudget)
      blocks.push(sb)
      strengthMin = sb.minutes
      ids.push(lift.id)
      lift.muscles.forEach(m => worked.add(m))
    }
  }

  // 残りはWODへ (ブロック間の移動・準備で1〜2分みる)。長すぎるWODは質が落ちるので上限を設ける
  const setup = B < 20 ? 1 : 2
  const wodCap = a.goal === 'stamina' ? 40 : 30
  const wodWork = clamp(B - strengthMin - accBudget - setup, 6, wodCap)
  const wodName = pick(rng, WOD_NAMES)
  const wod = buildWod(ctx, wodWork, wodName, lift)
  wod.block.minutes -= 2 - setup
  blocks.push(wod.block)
  wod.moves.forEach(m => {
    ids.push(m.id)
    m.muscles.forEach(x => worked.add(x))
  })

  // WODが想定より短く終わる分は補強へ回し、それでも余れば低強度の有酸素に
  let spare = B - strengthMin - wod.block.minutes
  if (B >= 35 && spare >= 5) {
    const accBlock = accessoryBlock(ctx, Math.min(spare, 20), lift)
    if (accBlock) {
      blocks.push(accBlock)
      spare -= accBlock.minutes
      accBlock.items.forEach(i => ids.push(i.id))
      const gx = accBlock.items.map(i => GYM_EXERCISES.find(e => e.id === i.id)!).filter(Boolean)
      gx.forEach(e => [e.muscle, ...(e.also ?? [])].forEach(m => worked.add(m)))
    }
  }
  if (spare >= 6) blocks.push(easyCardio(Math.min(spare, 20), 'box', a.injuries))

  // ---- 解説 ----
  if (lift) {
    why.push(
      `ストレングス (${lift.name}) を最初に置いています。重い重量は疲れる前に扱うのが、記録を伸ばしケガを防ぐ鉄則です。`,
    )
  }
  why.push(WOD_WHY[a.goal])
  why.push(wod.stimulus)
  if (a.condition === 'tired') why.push('疲れ気味なので、WODの回数設定を少し控えめにし、ストレングスのセット数を減らしています。')
  if (a.level === 'beginner') {
    why.push('各種目には Rx / Scaled / 初心者 の3段階を載せ、あなたに合うものに★を付けています。最初は★の動きで「止まらずに動き続けられること」を優先しましょう。')
  }
  const lastRating = gen.rating
  if (lastRating === 'hard') why.push('前回「きつかった」とのことなので、迷ったら★より1段階軽い設定を選んでOKです。')
  if (lastRating === 'easy') why.push('前回「余裕だった」とのことなので、今日は★より1段階上の設定に挑戦してみましょう。')

  const cautions: string[] = []
  injuryCautions(a, cautions)

  const next = [
    'WODのスコア (ラウンド数・タイム) を記録して、4〜8週間後に同じWODで比べると成長がはっきり分かります。',
    lift?.percent
      ? `${lift.name}の1RMを入力しておくと、次回から%に対応した重量が自動で表示されます。`
      : '自重種目は「前回より1回多く」を毎回の目標に。',
  ]

  return {
    focus: full ? [...worked] : focus,
    focusLabel: full ? '全身' : musclesText(focus),
    blocks,
    wodName,
    subtitle: [lift?.name, wod.short].filter(Boolean).join(' + '),
    firstMain: lift?.name,
    worked: [...worked],
    exerciseIds: ids,
    why,
    cautions,
    next,
  }
}

// ---------------- ストレングス ----------------

function pickLift(ctx: Ctx, gen: GenContext): Lift | undefined {
  const { a, rng, focus } = ctx
  const lvl = LEVEL_NUM[a.level]
  const pool = LIFTS.filter(l => l.level <= lvl && !l.avoid.some(i => a.injuries.includes(i)))
  return weighted(rng, pool, l => {
    let s = 1
    if (focus.length) {
      if (focus.includes(l.muscles[0])) s *= 4
      else if (l.muscles.some(m => focus.includes(m))) s *= 1.8
      else s *= 0.1
    }
    if (a.goal === 'athletic' && l.kind === 'oly') s *= 3
    // ストリクトプレスは速く挙げる種目ではないので、パワー目的では選びにくく
    if (a.goal === 'athletic' && l.id === 'strict-press') s *= 0.3
    if (a.goal === 'strength' && ['squat', 'hinge', 'press', 'bench'].includes(l.kind)) s *= 1.6
    if (a.goal === 'health' && l.kind === 'oly') s *= 0.3
    if (!l.percent && a.goal === 'strength') s *= 0.5
    const ago = gen.used[l.id]
    if (ago !== undefined) s *= ago <= 3 ? 0.15 : ago <= 7 ? 0.5 : 1
    return s
  })
}

function strengthBlock(lift: Lift, a: Answers, budgetMin: number): Block {
  const tired = a.condition === 'tired'
  const lvl = LEVEL_NUM[a.level]
  const minus = tired ? 5 : 0
  // 空のバーから徐々に重量を上げる時間
  const ramp = budgetMin <= 12 ? 120 : 240

  let sets = 5
  let reps = '5'
  let n = 5
  let pct: [number, number] = [70, 75]
  let rest = 120
  let format = '徐々に重量を上げてから、本番のセットを同じ重量で行う'
  let emom = 0
  const tips: string[] = []

  if (a.goal === 'athletic' && lift.kind === 'oly') {
    emom = clamp(budgetMin - ramp / 60, 6, 12)
    reps = lvl === 1 ? '3' : '2'
    pct = lvl === 1 ? [50, 60] : [70, 78]
    format = `EMOM ${emom}分: 毎分0秒に${reps}回。速さとキャッチの姿勢を最優先`
    tips.push('毎回のバースピードが落ちたら重量を戻す。重さより「速さ」がテーマ')
  } else if (a.goal === 'athletic' && lift.percent) {
    sets = 8
    reps = '3'
    n = 3
    pct = [60, 70]
    rest = 60
    format = 'スピードセット: 軽めの重量を、できるだけ速く挙げる'
    tips.push('1回1回、最大スピードで。動きが遅くなったら終了')
  } else if (a.goal === 'strength') {
    if (lvl === 1) {
      ;[sets, reps, n, pct, rest] = [5, '5', 5, [65, 75], 120]
      format = 'フォームが崩れない重量で 5×5。全セット同じ重量'
    } else if (lvl === 2) {
      ;[sets, reps, n, pct, rest] = [5, '3', 3, [80, 85], 150]
    } else {
      ;[sets, reps, n, pct, rest] = [6, '2', 2, [85, 90], 180]
    }
    tips.push('セット間はしっかり休む。息が整ってから次へ')
  } else if (a.goal === 'muscle') {
    ;[sets, reps, n, pct, rest] = lvl === 1 ? [3, '8', 8, [60, 70], 120] : [4, '8', 8, [70, 75], 120]
    tips.push('下ろす動作を2秒かけてコントロール')
  } else if (a.goal === 'lean' || a.goal === 'stamina') {
    ;[sets, reps, n, pct, rest] = [4, '6', 6, [60, 65], 90]
    format = 'テンポ: 3秒かけて下ろし、ボトムで1秒止めてから挙げる'
    tips.push('軽めの重量でも、テンポを守るとしっかり効く')
  } else {
    ;[sets, reps, n, pct, rest] = [3, '8', 8, [60, 65], 90]
    format = '余力を残す重量で、フォームを丁寧に'
  }

  if (!lift.percent) {
    // 自重・%が使えない種目は余力で指示
    reps = lift.kind === 'pull' ? (lvl === 1 ? '5' : '6〜8') : '8〜10'
    n = 8
  }

  if (tired) sets = Math.max(3, sets - 1)
  const lo = pct[0] - minus
  const hi = pct[1] - minus

  let seconds: number
  if (emom) {
    seconds = ramp + emom * 60
  } else {
    if (budgetMin <= 12) rest = roundRest(Math.min(rest, budgetMin <= 10 ? 90 : 120))
    while (sets > 3 && ramp + sets * (rest + n * 3) > budgetMin * 60) sets--
    seconds = ramp + sets * (rest + n * 3)
  }

  const item: Item = {
    id: lift.id,
    name: lift.name,
    en: lift.en,
    prescription: emom ? `EMOM ${emom}分 × ${reps}回` : `${sets}セット × ${reps}回`,
    sets: emom || sets,
    detail: lift.percent
      ? `1RMの${lo}〜${hi}%${emom ? '' : ` / 休憩 ${secText(rest)}`}`
      : `あと2回できる余力で止める / 休憩 ${secText(rest)}`,
    restSec: emom ? undefined : rest,
    cues: lift.cues,
    percent: lift.percent ? { lift: lift.name, lo, hi } : undefined,
  }

  return {
    key: 'strength',
    kind: 'strength',
    label: 'STRENGTH',
    title: `ストレングス: ${lift.name}`,
    minutes: Math.ceil(seconds / 60),
    format,
    items: [item],
    timer: emom ? { type: 'emom', minutes: emom, stations: [`${lift.name} ${reps}回`] } : undefined,
    tips: [
      lift.percent
        ? `最初の${ramp / 60}分で、空のバーから3〜4段階に分けて本番の重量まで上げる`
        : `最初の${ramp / 60}分で、補助付き・軽い負荷で動きを確認してから本番へ`,
      ...tips,
    ],
  }
}

// ---------------- WOD ----------------

const FORMATS: Record<Goal, (W: number) => Format[]> = {
  lean: W => (W <= 9 ? ['tabata', 'amrap', 'emom'] : W <= 20 ? ['amrap', 'emom', 'rounds'] : ['amrap', 'chipper', 'rounds', 'emom']),
  stamina: W => (W <= 10 ? ['amrap', 'emom'] : ['interval', 'rounds', 'chipper', 'amrap']),
  muscle: W => (W <= 12 ? ['ladder', 'amrap', 'emom'] : ['amrap', 'emom', 'rounds']),
  strength: W => (W <= 14 ? ['ladder', 'amrap'] : ['rounds', 'amrap']),
  athletic: W => (W <= 9 ? ['ladder', 'tabata'] : W <= 14 ? ['ladder', 'amrap', 'interval'] : ['interval', 'emom', 'rounds']),
  health: () => ['emom', 'amrap'],
}

const TEMPLATES: Record<number, Modality[][]> = {
  2: [['W', 'G'], ['M', 'W'], ['M', 'G'], ['W', 'G']],
  3: [['M', 'W', 'G'], ['W', 'G', 'M'], ['W', 'W', 'G'], ['G', 'W', 'M']],
  4: [['M', 'W', 'G', 'W'], ['W', 'G', 'M', 'G']],
  5: [['M', 'W', 'G', 'W', 'G'], ['W', 'G', 'M', 'W', 'G']],
}

interface MoveFilter {
  noRun?: boolean
  maxMid?: number
}

function chooseMoves(ctx: Ctx, k: number, lift: Lift | undefined, f: MoveFilter = {}): BoxMovement[] {
  const { a, rng, recent, focus } = ctx
  const maxLevel = LEVEL_NUM[a.level] === 3 ? 3 : 2
  const base = BOX_MOVEMENTS.filter(
    m =>
      m.level <= maxLevel &&
      !m.avoid.some(i => a.injuries.includes(i)) &&
      !(f.noRun && m.unit === 'm') &&
      !(f.maxMid && m.reps[1] > f.maxMid) &&
      !(a.goal === 'health' && m.level >= 2),
  )
  const template = shuffle(rng, pick(rng, TEMPLATES[k] ?? TEMPLATES[3]))
  const out: BoxMovement[] = []
  const groups = new Set<string>()
  const score = (m: BoxMovement) => {
    let s = 1
    if (focus.length) {
      if (focus.includes(m.muscles[0])) s *= 3
      else if (m.muscles.some(x => focus.includes(x))) s *= 1.8
    }
    if (recent.has(m.id)) s *= 0.4
    if (m.id === 'ski') s *= 0.5
    if (lift && lift.muscles[0] === m.muscles[0] && m.mod === 'W') s *= 0.5
    return s
  }
  for (const mod of template) {
    const pool = base.filter(m => !groups.has(m.group) && !out.includes(m))
    const choice = weighted(rng, pool.filter(m => m.mod === mod), score) ?? weighted(rng, pool, score)
    if (!choice) break
    out.push(choice)
    groups.add(choice.group)
  }
  // 部位を指定したのにWODに1つも入らなかった場合は1つ差し替える
  if (focus.length && out.length && !out.some(m => m.muscles.some(x => focus.includes(x)))) {
    const swap = weighted(
      rng,
      base.filter(m => m.muscles.some(x => focus.includes(x)) && !out.includes(m) && !out.slice(1).some(o => o.group === m.group)),
      score,
    )
    if (swap) out[0] = swap
  }
  return out
}

/** 1回あたりの秒数 (女性基準のカロリーは8割で計算済み) */
function secPer(m: BoxMovement, ctx: Ctx): number {
  return m.sec * ctx.pace
}

function roundSec(moves: BoxMovement[], reps: number[], ctx: Ctx): number {
  return moves.reduce((s, m, i) => s + reps[i] * secPer(m, ctx), 0) + moves.length * 8
}

function scaleReps(moves: BoxMovement[], targetSec: number, ctx: Ctx, which: 0 | 1 | 2 = 1): number[] {
  const base = moves.map(m => m.reps[which])
  const factor = targetSec / roundSec(moves, base, ctx)
  return moves.map((m, i) =>
    niceReps(clamp(base[i] * factor, Math.max(1, m.reps[0] * 0.6), m.reps[2] * 1.5), m.unit),
  )
}

function unitText(m: BoxMovement, n: number, scale: Answers['scale']): string {
  if (m.unit === 'cal') return `${scale === 'women' ? Math.round(n * 0.8) : n}cal`
  if (m.unit === 'm') return `${n}m`
  return `${n}回`
}

function recommended(m: BoxMovement, a: Answers): Variant['label'] {
  const order: Variant['label'][] = ['初心者', 'Scaled', 'Rx']
  // 中級者でもバーベル等の Rx 重量は重いので Scaled から。自重・有酸素の基本種目は Rx
  let i = a.level === 'beginner' ? 0 : a.level === 'intermediate' ? (m.level === 1 && m.mod !== 'W' ? 2 : 1) : m.level === 3 ? 1 : 2
  if (a.condition === 'tired') i = Math.max(0, i - 1)
  return order[i]
}

function moveItem(m: BoxMovement, n: number | undefined, ctx: Ctx, prescription?: string): Item {
  const { a } = ctx
  const variants: Variant[] = [
    { label: 'Rx', text: byScale(m.rx, a.scale) },
    { label: 'Scaled', text: byScale(m.scaled, a.scale) },
    { label: '初心者', text: byScale(m.beginner, a.scale) },
  ]
  return {
    id: m.id,
    name: m.name,
    en: m.en,
    prescription: prescription ?? (n !== undefined ? unitText(m, n, a.scale) : ''),
    cues: m.cues,
    variants,
    recommended: recommended(m, a),
  }
}

interface WodResult {
  block: Block
  moves: BoxMovement[]
  short: string
  stimulus: string
}

function buildWod(ctx: Ctx, W: number, name: string, lift: Lift | undefined): WodResult {
  const { a, rng } = ctx
  const options = FORMATS[a.goal](W).filter(f => (f !== 'tabata' || W >= 8) && (f !== 'chipper' || W <= 25))
  const format = pick(rng, options)
  const res = (() => {
    switch (format) {
      case 'amrap': return amrap(ctx, W, lift)
      case 'rounds': return rounds(ctx, W, lift)
      case 'ladder': return ladder(ctx, W, lift) ?? amrap(ctx, W, lift)
      case 'chipper': return chipper(ctx, W, lift)
      case 'emom': return emom(ctx, W, lift)
      case 'interval': return interval(ctx, W, lift)
      case 'tabata': return tabata(ctx, lift)
    }
  })()
  res.block.key = 'wod'
  res.block.kind = 'wod'
  res.block.label = 'WOD'
  res.block.title = `"${name}" ${res.block.title}`
  res.block.tips = [...(res.block.tips ?? []), ...WOD_TIPS[a.goal]]
  return res
}

function amrap(ctx: Ctx, W: number, lift: Lift | undefined): WodResult {
  const { a } = ctx
  const k = W <= 10 && (a.goal === 'strength' || a.goal === 'muscle') ? 2 : 3
  const moves = chooseMoves(ctx, k, lift)
  const target = Math.min({ lean: 120, stamina: 150, muscle: 90, strength: 75, athletic: 75, health: 120 }[a.goal], (W * 60) / 3)
  const reps = scaleReps(moves, target, ctx)
  const rt = roundSec(moves, reps, ctx)
  const r = (W * 60) / rt
  const lo = Math.max(1, Math.floor(r * 0.85))
  const hi = Math.max(lo + 1, Math.ceil(r * 1.1))
  return {
    moves,
    short: `AMRAP ${W}分`,
    stimulus: `AMRAP ${W}分は「1ラウンド約${Math.round(rt)}秒」で組んでいます。目標は${lo}〜${hi}ラウンド。止まらずに動き続けられるペースが正解です。`,
    block: {
      key: '', kind: 'wod', label: '',
      title: `AMRAP ${W}分`,
      minutes: W + 2,
      format: `${W}分間で、下の種目を上から順にできるだけ多く繰り返す (スコア = ラウンド数 + 端数の回数)`,
      items: moves.map((m, i) => moveItem(m, reps[i], ctx)),
      timer: { type: 'amrap', minutes: W },
      tips: [
        `目標: ${lo}〜${hi}ラウンド`,
        '最初の2ラウンドは8割のペースで。最後の3分で上げる',
        ...(W >= 25 ? ['長丁場なので、重量は★より1段階軽くてもOK'] : []),
      ],
    },
  }
}

function rounds(ctx: Ctx, W: number, lift: Lift | undefined): WodResult {
  const { a } = ctx
  let R = W <= 12 ? 3 : W <= 20 ? 4 : 5
  const moves = chooseMoves(ctx, a.goal === 'strength' ? 2 : 3, lift)
  const reps = scaleReps(moves, (W * 60) / R, ctx)
  const rs = roundSec(moves, reps, ctx)
  // 回数の上限で1周が短くなった場合は周回数で埋める
  while (rs * (R + 1) <= W * 60 * 1.05 && R < 10) R++
  const est = Math.max(1, Math.round((rs * R) / 60))
  const cap = Math.ceil(Math.max(est, W) * 1.3)
  return {
    moves,
    short: `${R} Rounds For Time`,
    stimulus: `${R}ラウンドを約${est}分で終える設計です。タイムキャップ${cap}分に間に合わなければ、残りの回数がスコアになります。`,
    block: {
      key: '', kind: 'wod', label: '',
      title: `${R} ROUNDS FOR TIME`,
      minutes: Math.min(W, est) + 2,
      format: `下の種目を${R}周、できるだけ速く終わらせる (タイムキャップ ${cap}分)`,
      items: moves.map((m, i) => moveItem(m, reps[i], ctx)),
      timer: { type: 'fortime', capMinutes: cap },
      tips: [`目安タイム: ${est}分前後`, '1ラウンド目のタイムを最後まで維持するつもりで'],
    },
  }
}

const LADDERS = [
  [21, 15, 9],
  [15, 12, 9],
  [12, 9, 6],
  [10, 8, 6, 4, 2],
]

function ladder(ctx: Ctx, W: number, lift: Lift | undefined): WodResult | undefined {
  const moves = chooseMoves(ctx, 2, lift, { noRun: true })
  if (moves.length < 2) return undefined
  const mult = moves.map(m => (m.reps[1] >= 30 ? Math.round(m.reps[1] / 12) : 1))
  const estFor = (scheme: number[]) => {
    const total = scheme.reduce((s, x) => s + x, 0)
    return moves.reduce((s, m, i) => s + total * mult[i] * secPer(m, ctx), 0) + scheme.length * moves.length * 8
  }
  const best = LADDERS.map(sc => ({ sc, est: estFor(sc) })).sort(
    (x, y) => Math.abs(x.est - W * 60) - Math.abs(y.est - W * 60),
  )[0]
  if (Math.abs(best.est - W * 60) > W * 60 * 0.45) return undefined
  const est = Math.max(1, Math.round(best.est / 60))
  const cap = Math.max(est + 2, Math.ceil(W * 1.2))
  const label = best.sc.join('-')
  return {
    moves,
    short: `${label} For Time`,
    stimulus: `${label} は短く強度の高い形式。目安${est}分、最後まで重量とスピードを落とさないことが狙いです。`,
    block: {
      key: '', kind: 'wod', label: '',
      title: `${label} FOR TIME`,
      minutes: Math.min(W, est) + 2,
      format: `2種目を${best.sc.map(x => `${x}回`).join('→')}と減らしながら交互に行う (タイムキャップ ${cap}分)`,
      items: moves.map((m, i) =>
        moveItem(m, undefined, ctx, best.sc.map(x => (m.unit === 'cal' ? unitText(m, x * mult[i], ctx.a.scale) : x * mult[i])).join('-') + (m.unit === 'cal' ? '' : '回')),
      ),
      timer: { type: 'fortime', capMinutes: cap },
      tips: [`目安タイム: ${est}分前後`, `最初の${best.sc[0]}回は最初から小分けにする前提でOK (例: ${Math.ceil(best.sc[0] / 2)}-${Math.floor(best.sc[0] / 2)})`],
    },
  }
}

function chipper(ctx: Ctx, W: number, lift: Lift | undefined): WodResult {
  const moves = chooseMoves(ctx, 5, lift)
  const reps = scaleReps(moves, W * 60, ctx, 2)
  const est = Math.max(1, Math.round(roundSec(moves, reps, ctx) / 60))
  const cap = Math.ceil(Math.max(est, W) * 1.25)
  return {
    moves,
    short: 'Chipper',
    stimulus: `チッパーは上から1種目ずつ「削っていく」長めのWOD。目安${est}分、ペース配分と粘りが試されます。`,
    block: {
      key: '', kind: 'wod', label: '',
      title: 'CHIPPER FOR TIME',
      minutes: Math.min(W, est) + 2,
      format: `上から順に、各種目の回数を終わらせてから次へ (1周のみ・タイムキャップ ${cap}分)`,
      items: moves.map((m, i) => moveItem(m, reps[i], ctx)),
      timer: { type: 'fortime', capMinutes: cap },
      tips: [`目安タイム: ${est}分前後`, '回数が多い種目は最初から小分けに。止まる時間を短くするのがコツ'],
    },
  }
}

function emom(ctx: Ctx, W: number, lift: Lift | undefined): WodResult {
  const { a } = ctx
  const restMinute = a.goal === 'health' || a.condition === 'tired' || a.level === 'beginner'
  let k = W <= 12 ? 2 : 3
  if (W >= 16 && !restMinute) k = 4
  const moves = chooseMoves(ctx, k, lift, { noRun: true })
  const stations = moves.length + (restMinute ? 1 : 0)
  const minutes = Math.max(stations * 2, Math.floor(W / stations) * stations)
  const workTarget = { lean: 40, stamina: 42, muscle: 40, strength: 30, athletic: 30, health: 30 }[a.goal]
  const reps = moves.map(m => niceReps(clamp(workTarget / secPer(m, ctx), m.reps[0] * 0.5, m.reps[2]), m.unit))
  const items = moves.map((m, i) => moveItem(m, reps[i], ctx, `${i + 1}分目: ${unitText(m, reps[i], a.scale)}`))
  const labels = moves.map((m, i) => `${m.name} ${unitText(m, reps[i], a.scale)}`)
  if (restMinute) {
    items.push({ id: 'emom-rest', name: '休憩 (または プランク)', prescription: `${stations}分目: 休む`, detail: '呼吸を整える。余裕があればプランク' })
    labels.push('休憩')
  }
  return {
    moves,
    short: `EMOM ${minutes}分`,
    stimulus: `EMOM は毎分休憩が入るので、強度を保ったまま総量を稼げます。各分の作業は約${workTarget}秒、残りが休憩です。`,
    block: {
      key: '', kind: 'wod', label: '',
      title: `EMOM ${minutes}分`,
      minutes: minutes + 2,
      format: `毎分0秒に開始し、指定回数を終えたら残りは休憩。${stations}種目を順番に${minutes / stations}周`,
      items,
      timer: { type: 'emom', minutes, stations: labels },
      tips: ['毎分15〜20秒休めるのが適正。休めなくなったら回数を2〜3回減らす'],
    },
  }
}

function interval(ctx: Ctx, W: number, lift: Lift | undefined): WodResult {
  const { a } = ctx
  const on = a.goal === 'athletic' ? (W >= 24 ? 3 : 2) : W >= 20 ? 4 : 3
  const R = clamp(Math.floor((W + 1) / (on + 1)), 2, 8)
  const moves = chooseMoves(ctx, 3, lift, { noRun: on < 3 })
  // 先頭を有酸素にそろえる (なければそのまま)
  const mi = moves.findIndex(m => m.mod === 'M')
  if (mi > 0) moves.unshift(moves.splice(mi, 1)[0])
  const monoTarget = on * 60 * 0.3
  const head = moves[0]
  const headN = niceReps(monoTarget / secPer(head, ctx), head.unit)
  const rest = moves.slice(1)
  const restReps = scaleReps(rest, 45, ctx)
  return {
    moves,
    short: `${R}×(${on}分ON/1分OFF)`,
    stimulus: `${on}分全力・1分休憩のインターバル。休憩があるぶん毎ラウンド高い強度を出せ、心肺機能が最も伸びる刺激です。`,
    block: {
      key: '', kind: 'wod', label: '',
      title: `${R} ROUNDS: ${on}分ON / 1分OFF`,
      minutes: R * (on + 1) + 1,
      format: `ON の${on}分間: まず ${head.name} を終え、残り時間で下の2種目をAMRAP。1分休んで次のラウンド (スコア = 全ラウンドの合計回数)`,
      items: [
        moveItem(head, headN, ctx, `まず ${unitText(head, headN, a.scale)}`),
        ...rest.map((m, i) => moveItem(m, restReps[i], ctx, `残り時間で ${unitText(m, restReps[i], a.scale)} を繰り返す`)),
      ],
      timer: { type: 'interval', rounds: R, workSec: on * 60, restSec: 60, label: 'ON' },
      tips: ['どのラウンドもスコアが大きく落ちないペースで', 'OFF の1分は歩いて呼吸を整える'],
    },
  }
}

function tabata(ctx: Ctx, lift: Lift | undefined): WodResult {
  const moves = chooseMoves(ctx, 2, lift, { noRun: true })
  return {
    moves,
    short: 'タバタ 8分',
    stimulus: 'タバタは20秒全力・10秒休憩の超高強度インターバル。短時間で心肺を限界まで追い込みます。',
    block: {
      key: '', kind: 'wod', label: '',
      title: 'TABATA 8分',
      minutes: 10,
      format: '20秒全力 / 10秒休憩 × 16本。2種目を交互に (スコア = 各本の最低回数の合計)',
      items: moves.map(m => moveItem(m, undefined, ctx, '20秒で最大回数')),
      timer: { type: 'interval', rounds: 16, workSec: 20, restSec: 10, label: moves.map(m => m.name).join(' / ') },
      tips: ['毎本の回数をメモ。最低回数が落ちないよう前半を抑える'],
    },
  }
}

// ---------------- 補強 ----------------

function accessoryBlock(ctx: Ctx, budgetMin: number, lift: Lift | undefined): Block | undefined {
  const { a, rng, recent, focus } = ctx
  const lvl = LEVEL_NUM[a.level]
  const targets: Muscle[] = focus.length ? focus : shuffle(rng, ['back', 'glutes', 'shoulders', 'core'] as Muscle[]).slice(0, 2)
  const want = budgetMin >= 12 ? 3 : 2
  const chosen: GymExercise[] = []
  const pool = GYM_EXERCISES.filter(
    e => e.box && e.level <= lvl && !e.avoid.some(i => a.injuries.includes(i)) && e.kind !== 'power' && e.equip !== 'barbell',
  )
  for (let i = 0; chosen.length < want && i < want * 3; i++) {
    const m = targets[i % targets.length]
    const ex = weighted(
      rng,
      pool.filter(e => (e.muscle === m || (e.also ?? []).includes(m)) && !chosen.includes(e) && !chosen.some(c => c.slot === e.slot)),
      e => (e.muscle === m ? 3 : 1) * (recent.has(e.id) ? 0.4 : 1) * (lift && lift.muscles[0] === e.muscle && e.kind === 'compound' ? 0.4 : 1),
    )
    if (ex) chosen.push(ex)
  }
  if (!focus.includes('core') && chosen.length < want + 1) {
    const core = weighted(rng, pool.filter(e => e.muscle === 'core' && !chosen.includes(e)), e => (recent.has(e.id) ? 0.4 : 1))
    if (core && budgetMin >= 10) chosen.push(core)
  }
  if (!chosen.length) return undefined

  const reps = a.goal === 'muscle' ? '10〜12' : a.goal === 'strength' ? '8〜10' : '12〜15'
  const roundSecOf = (list: GymExercise[]) => list.reduce((s, e) => s + 40 * (e.each ? 1.8 : 1) + 25, 0) + 45
  // 最低2周できる種目数まで減らす。それでも入らなければ補強はなし
  while (chosen.length > 1 && roundSecOf(chosen) * 2 > budgetMin * 60) chosen.pop()
  const perRound = roundSecOf(chosen)
  const R = Math.min(4, Math.floor((budgetMin * 60) / perRound))
  if (R < 2) return undefined
  return {
    key: 'accessory',
    kind: 'accessory',
    label: 'ACCESSORY',
    title: `補強 ${R}ラウンド`,
    minutes: Math.ceil((R * perRound) / 60),
    format: `タイムは競わない。各種目を丁寧に、上から順に${R}周 (種目間の休憩は短く、1周ごとに45秒休む)`,
    items: chosen.map(e => ({
      id: e.id,
      name: e.name,
      en: e.en,
      prescription: `${R}セット × ${e.unit === 'sec' ? '40秒' : `${reps}回`}${e.each ? ' (左右各)' : ''}`,
      sets: R,
      detail: e.unit === 'sec' ? 'フォームが崩れる手前まで' : 'あと2回できる余力で止める',
      cues: e.cues,
      swappable: true,
    })),
    tips: ['WODで使い切れなかった部位・弱点を丁寧に鍛える時間'],
  }
}

const WOD_WHY: Record<Goal, string> = {
  lean: 'WODは中程度の重量で長めに動き続ける設定。心拍を高く保つ時間を長くとることで、消費カロリーを最大化します。',
  muscle: 'ストレングスと補強で筋肉に十分な負荷をかけ、WODは筋肉を追い込みすぎない時間に抑えています。',
  strength: '主役はストレングス。WODは短く強度の高い形式にして、重量を扱う力を削らないようにしています。',
  stamina: '時間の大半をWODに配分し、心肺に「長く・繰り返し」負荷をかける構成です。',
  athletic: 'パワー (速く力を出す) を最初に鍛え、WODでは複数の動きを切り替えるスピードを鍛えます。',
  health: '休憩を挟みやすい形式で、全身をまんべんなく動かすことを優先しています。ケガなく続けることが最大の成果です。',
}

const WOD_TIPS: Record<Goal, string[]> = {
  lean: ['重量より「止まらないこと」を優先して★を選ぶ'],
  muscle: ['WODの重量は「全ラウンドを分けずにできる」重さが目安'],
  strength: ['重量は Rx に近づけ、回数を小分けにしてでも重さを保つ'],
  stamina: ['呼吸が上がりきる前に動き続けられるペースを探す'],
  athletic: ['一つひとつの動作をキレよく。疲れてもフォームを崩さない'],
  health: ['会話がぎりぎりできる強度が目安。きつければ休んでOK'],
}

export function boxAlternative(id: string, a: Answers, exclude: Set<string>, rng: Rng): GymExercise | undefined {
  const cur = GYM_EXERCISES.find(e => e.id === id)
  if (!cur) return undefined
  const lvl = LEVEL_NUM[a.level]
  const pool = GYM_EXERCISES.filter(
    e => e.box && e.muscle === cur.muscle && e.level <= lvl && !exclude.has(e.id) && !e.avoid.some(i => a.injuries.includes(i)) && e.equip !== 'barbell',
  )
  return weighted(rng, pool, () => 1)
}
