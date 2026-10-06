// 施設型ジム向けのメニュー生成。
// 部位ごとの「枠」を優先順に埋め、目的に応じたセット・回数・休憩を割り当て、
// 使える時間に収まる種目数を決める (収まらなければスーパーセットにする)。

import { BOOKEND_MIN, LEVEL_NUM, agoText, clamp, roundRest, secText, type GenContext } from './common'
import { GYM_BY_ID, GYM_EXERCISES, SLOT_ORDER, availableFor, type GymExercise, type Kind, type Slot } from './exercises'
import { GEAR_LABEL, GOAL_LABEL, isAway, musclesText } from './labels'
import { shuffle, weighted, type Rng } from './rng'
import { easyCardio, intervals, steady } from './cardio'
import type { Answers, Block, Goal, Item, Muscle } from './types'

type Role = 'main' | Kind

interface Rx {
  sets: number
  /** 表示用の回数 (「6〜8」) */
  reps: string
  /** 時間計算用の回数 */
  n: number
  rest: number
  /** あと何回できる余力で止めるか */
  rir: number
}

const RX: Record<Goal, Record<Role, Rx>> = {
  strength: {
    main: { sets: 5, reps: '5', n: 5, rest: 180, rir: 2 },
    compound: { sets: 4, reps: '6〜8', n: 7, rest: 120, rir: 2 },
    iso: { sets: 3, reps: '8〜12', n: 10, rest: 75, rir: 2 },
    core: { sets: 3, reps: '10', n: 10, rest: 60, rir: 2 },
    power: { sets: 4, reps: '3〜5', n: 4, rest: 90, rir: 3 },
  },
  muscle: {
    main: { sets: 4, reps: '6〜8', n: 7, rest: 120, rir: 1 },
    compound: { sets: 3, reps: '8〜12', n: 10, rest: 90, rir: 1 },
    iso: { sets: 3, reps: '12〜15', n: 13, rest: 60, rir: 1 },
    core: { sets: 3, reps: '12〜15', n: 13, rest: 45, rir: 1 },
    power: { sets: 3, reps: '5', n: 5, rest: 75, rir: 3 },
  },
  lean: {
    main: { sets: 3, reps: '10〜12', n: 11, rest: 60, rir: 2 },
    compound: { sets: 3, reps: '12', n: 12, rest: 45, rir: 2 },
    iso: { sets: 3, reps: '15', n: 15, rest: 30, rir: 2 },
    core: { sets: 3, reps: '15', n: 15, rest: 30, rir: 2 },
    power: { sets: 3, reps: '10', n: 10, rest: 45, rir: 3 },
  },
  stamina: {
    main: { sets: 3, reps: '15', n: 15, rest: 30, rir: 3 },
    compound: { sets: 3, reps: '15', n: 15, rest: 30, rir: 3 },
    iso: { sets: 3, reps: '15〜20', n: 18, rest: 30, rir: 3 },
    core: { sets: 3, reps: '15', n: 15, rest: 30, rir: 3 },
    power: { sets: 3, reps: '10', n: 10, rest: 30, rir: 3 },
  },
  athletic: {
    main: { sets: 4, reps: '5〜6', n: 6, rest: 150, rir: 2 },
    compound: { sets: 3, reps: '8', n: 8, rest: 90, rir: 2 },
    iso: { sets: 2, reps: '12', n: 12, rest: 60, rir: 2 },
    core: { sets: 3, reps: '8', n: 8, rest: 45, rir: 2 },
    power: { sets: 4, reps: '5', n: 5, rest: 90, rir: 4 },
  },
  health: {
    main: { sets: 3, reps: '10', n: 10, rest: 90, rir: 3 },
    compound: { sets: 3, reps: '10〜12', n: 11, rest: 75, rir: 3 },
    iso: { sets: 2, reps: '12〜15', n: 13, rest: 60, rir: 3 },
    core: { sets: 3, reps: '10', n: 10, rest: 45, rir: 3 },
    power: { sets: 3, reps: '6', n: 6, rest: 75, rir: 4 },
  },
}

/** 秒数指定の種目 (プランク等) の1セットの秒数 */
const HOLD_SEC: Record<Goal, number> = { strength: 30, muscle: 40, lean: 40, stamina: 45, athletic: 30, health: 30 }

/** 1RMに対する目安% (回数とRIRから) */
function percentFor(n: number, rir: number): [number, number] {
  const reps = n + rir
  if (reps <= 5) return [83, 88]
  if (reps <= 7) return [78, 83]
  if (reps <= 9) return [72, 78]
  if (reps <= 12) return [67, 72]
  return [60, 67]
}

function rirText(rir: number): string {
  if (rir <= 1) return 'あと1〜2回できる余力で止める (RIR1)'
  if (rir === 2) return 'あと2回できる余力で止める (RIR2)'
  if (rir === 3) return 'あと3回できる余力を残す (RIR3)'
  return '軽めで、毎回キレよく全力で'
}

interface Planned {
  ex: GymExercise
  role: Role
  rx: Rx
  /** 昨日・おととい鍛えた部位なので量を減らした */
  fatigued?: boolean
  /** 自重で筋力を狙うときのテンポ指示 */
  tempo?: boolean
}

function workSec(p: Planned, goal: Goal): number {
  const per = p.ex.unit === 'sec' ? HOLD_SEC[goal] : p.rx.n * (goal === 'muscle' ? 4 : 3.5)
  return per * (p.ex.each ? 2 : 1)
}

function setupSec(p: Planned): number {
  return p.role === 'main' && (p.ex.equip === 'barbell' || p.ex.equip === 'machine') ? 150 : 45
}

function groupSec(g: Planned[], goal: Goal): number {
  const sets = Math.max(...g.map(p => p.rx.sets))
  const work = g.reduce((s, p) => s + workSec(p, goal), 0) + (g.length - 1) * 20
  const rest = Math.max(...g.map(p => p.rx.rest))
  return g.reduce((s, p) => s + setupSec(p), 0) + sets * (work + rest)
}

function totalSec(groups: Planned[][], goal: Goal): number {
  return groups.reduce((s, g) => s + groupSec(g, goal), 0)
}

const LOWER = new Set<Muscle>(['legs', 'glutes'])

/** 隣り合う種目を「競合しない部位」同士でペアにする (スーパーセット) */
function pairUp(list: Planned[], keepMainSingle: boolean): Planned[][] {
  const groups: Planned[][] = []
  const used = new Set<number>()
  for (let i = 0; i < list.length; i++) {
    if (used.has(i)) continue
    used.add(i)
    const a = list[i]
    if (keepMainSingle && a.role === 'main') {
      groups.push([a])
      continue
    }
    let partner = -1
    for (let j = i + 1; j < list.length; j++) {
      if (used.has(j)) continue
      const b = list[j]
      const clash = a.ex.muscle === b.ex.muscle || (LOWER.has(a.ex.muscle) && LOWER.has(b.ex.muscle))
      if (!clash) {
        partner = j
        break
      }
    }
    if (partner >= 0) {
      used.add(partner)
      groups.push([a, list[partner]])
    } else {
      groups.push([a])
    }
  }
  return groups
}

/** 複数の部位で共有する枠。1回のメニューで重ねると腰・脚の疲労が偏る */
const SHARED_SLOTS = new Set<Slot>(['hinge', 'unilateral', 'shoulders.rear', 'power'])

interface Ctx {
  a: Answers
  rng: Rng
  recent: Set<string>
  used: Set<string>
}

function pickExercise(slot: Slot, ctx: Ctx): GymExercise | undefined {
  const { a, rng, recent, used } = ctx
  const lvl = LEVEL_NUM[a.level]
  const candidates = GYM_EXERCISES.filter(
    e => e.slot === slot && e.level <= lvl && !used.has(e.id) && !e.avoid.some(i => a.injuries.includes(i)) && availableFor(e, a),
  )
  const away = isAway(a.env)
  return weighted(rng, candidates, e => {
    let s = 1
    if (recent.has(e.id)) s *= 0.35
    if (away) {
      // 道具があるなら負荷を上げやすい種目を、慣れた人には易しすぎる自重種目を避ける
      if ((a.goal === 'muscle' || a.goal === 'strength') && e.equip !== 'bodyweight') s *= 2.5
      if (lvl >= 2 && (e.id === 'knee-push-up' || e.id === 'incline-push-up')) s *= 0.05
      if (lvl >= 2 && (a.goal === 'strength' || a.goal === 'muscle') && (e.id === 'chair-squat' || e.id === 'bw-squat')) s *= 0.3
      if (lvl >= 2 && (a.goal === 'strength' || a.goal === 'muscle') && e.id === 'pistol-box') s *= 4
      if (lvl === 3 && e.level === 3) s *= 2
    }
    if (a.level === 'beginner') s *= e.equip === 'machine' || e.equip === 'cable' ? 1.6 : e.equip === 'barbell' ? 0.6 : 1
    if (a.level === 'advanced' && (e.equip === 'barbell' || e.equip === 'dumbbell')) s *= 1.4
    // 筋力・パワーが目的ならメイン種目はバーベルを強く優先する
    if ((a.goal === 'strength' || a.goal === 'athletic') && e.equip === 'barbell' && e.kind === 'compound') s *= a.level === 'beginner' ? 3 : 10
    // サーキットは移動が多いので、バーベルや高難度の自重種目は避ける
    if (a.goal === 'stamina' && (e.equip === 'barbell' || e.id === 'pull-up' || e.id === 'dips')) s *= 0.2
    if (a.goal === 'health' && e.equip !== 'barbell') s *= 1.3
    if (a.goal === 'muscle' && (e.equip === 'cable' || e.equip === 'machine') && e.kind === 'iso') s *= 1.3
    return s
  })
}

/** おまかせのとき、履歴から今日の部位を決める */
function autoFocus(a: Answers, last: Partial<Record<Muscle, number>>, rng: Rng): { focus: Muscle[]; full: boolean; reason: string } {
  const full = a.minutes <= 30 || a.level === 'beginner' || ['lean', 'stamina', 'health', 'athletic'].includes(a.goal)
  if (full) {
    return {
      focus: ['legs', 'chest', 'back', 'shoulders', 'core'],
      full: true,
      reason:
        a.level === 'beginner'
          ? '始めたばかりの時期は、毎回全身を少しずつ鍛えるのがいちばん伸びます。'
          : `${GOAL_LABEL[a.goal]}が目的なので、全身の大きな筋肉をまとめて動かして消費と効果を最大にします。`,
    }
  }
  const splits: { name: string; muscles: Muscle[] }[] = [
    { name: '胸・肩', muscles: ['chest', 'shoulders', 'arms'] },
    { name: '背中・腕', muscles: ['back', 'arms'] },
    { name: '脚・お尻', muscles: ['legs', 'glutes', 'core'] },
  ]
  const freshness = (s: { muscles: Muscle[] }) => Math.min(...s.muscles.slice(0, 2).map(m => last[m] ?? 99))
  const ordered = shuffle(rng, splits).sort((x, y) => freshness(y) - freshness(x))
  const chosen = ordered[0]
  const ago = freshness(chosen)
  return {
    focus: chosen.muscles,
    full: false,
    reason:
      ago >= 99
        ? `${chosen.name}はこの1週間鍛えていない部位なので、今日はここを中心にします。次回は別の部位を提案します。`
        : `${chosen.name}は最後に鍛えてから${ago}日空いていて、いちばん回復している部位です。`,
  }
}

export function buildGym(a: Answers, rng: Rng, gen: GenContext) {
  const last = gen.ago
  const recent = new Set(Object.keys(gen.used))
  const why: string[] = []
  const cautions: string[] = []

  let focus = a.focus
  let full = false
  if (focus.length === 0) {
    const auto = autoFocus(a, last, rng)
    focus = auto.focus
    full = auto.full
    why.push(auto.reason)
  }

  // 前回の「きつさ」でボリュームを微調整する
  const lastRating = gen.rating
  const volAdj = lastRating === 'hard' ? -1 : lastRating === 'easy' ? 1 : 0

  const ctx: Ctx = { a, rng, recent, used: new Set() }

  // ---- 種目の候補を枠の優先順に並べる ----
  // 枠のリストは2周させる (時間が長い日は同じ部位の別種目で角度を変える)
  let slots: Slot[] = []
  if (full) {
    slots = [...SLOT_ORDER.full, ...SLOT_ORDER.full]
  } else {
    const lists = focus.map(m => [...SLOT_ORDER[m], ...SLOT_ORDER[m]])
    const longest = Math.max(...lists.map(l => l.length))
    for (let i = 0; i < longest; i++) lists.forEach(l => l[i] && slots.push(l[i]))
    // 腹筋を選んでいなくても、時間が余れば体幹を最後に入れる
    if (!focus.includes('core')) slots.push('core.antiext')
    // サーキットは全身を回すほうが心拍が落ちない
    if (a.goal === 'stamina') slots.push(...SLOT_ORDER.full)
  }
  if (a.goal === 'athletic') slots.unshift('power')

  const takenSlots = new Set<Slot>()
  const picked: GymExercise[] = []
  for (const slot of slots) {
    if (SHARED_SLOTS.has(slot) && takenSlots.has(slot)) continue
    const ex = pickExercise(slot, ctx)
    if (!ex) continue
    ctx.used.add(ex.id)
    takenSlots.add(slot)
    picked.push(ex)
  }

  // パワー → 多関節 → 単関節 → 体幹 の順に並べる (選んだ順は保ったまま)
  const rank = (e: GymExercise) => ({ power: 0, compound: 1, iso: 2, core: 3 })[e.kind]
  const sortByKind = (list: Planned[]) =>
    list.map((p, i) => ({ p, i })).sort((x, y) => rank(x.p.ex) - rank(y.p.ex) || x.i - y.i).map(x => x.p)

  const lvl = LEVEL_NUM[a.level]
  const firstCompound = picked.map((e, i) => ({ e, i })).sort((x, y) => rank(x.e) - rank(y.e) || x.i - y.i).find(x => x.e.kind === 'compound')?.e
  const planned: Planned[] = picked.map(ex => {
    const role: Role = ex === firstCompound ? 'main' : ex.kind
    const base = RX[a.goal][role]
    let sets = base.sets
    let rir = base.rir
    if (a.level === 'beginner' && sets >= 4) sets -= 1
    if (a.level === 'beginner') rir = Math.max(rir, 3)
    if (a.level === 'advanced' && role === 'main') sets += 1
    if (role === 'main' || role === 'compound') sets += volAdj
    if (a.condition === 'tired') {
      sets -= 1
      rir += 1
    }
    const fatigued = (last[ex.muscle] ?? 99) <= 1 && !full
    if (fatigued) sets -= 1
    sets = clamp(sets, 2, 6)
    let rest = base.rest
    if (a.minutes <= 30) rest = roundRest(rest * 0.75)
    // 自重種目は1セットの消耗が小さいので、長すぎる休憩はとらない
    if (ex.equip === 'bodyweight') rest = Math.min(rest, 120)
    let reps = base.reps
    let n = base.n
    if (a.goal === 'strength' && role === 'main' && lvl === 3) {
      reps = '3〜5'
      n = 4
    }
    // 自重種目は重さで調整できないので、回数とテンポで負荷を決める
    if (ex.equip === 'bodyweight' && ex.unit !== 'sec' && ex.slot !== 'back.vpull' && role !== 'power') {
      if (a.goal === 'muscle') {
        reps = '12〜20'
        n = 16
      } else if (a.goal === 'strength') {
        reps = '6〜10'
        n = 8
      }
    }
    const tempo = isAway(a.env) && ex.equip === 'bodyweight' && a.goal === 'strength' && ex.unit !== 'sec' && role !== 'power'
    return { ex, role, rx: { sets, reps, n: tempo ? n + 4 : n, rest, rir }, fatigued, tempo }
  })

  // ---- 時間配分 ----
  const finisher = planFinisher(a, rng)
  const budget = (a.minutes - BOOKEND_MIN) * 60 - (finisher ? finisher.minutes * 60 : 0)
  const maxCount = a.level === 'beginner' ? 6 : a.level === 'intermediate' ? 8 : 9

  // 1回で1部位にかけるセット数の上限。これ以上は効果が頭打ちで疲労だけが増える
  const setCap = (m: Muscle) => (full ? 8 : m === 'core' ? 9 : { beginner: 10, intermediate: 14, advanced: 18 }[a.level])
  const setsOf = (list: Planned[], m: Muscle) => list.filter(p => p.ex.muscle === m).reduce((s, p) => s + p.rx.sets, 0)
  const kept: Planned[] = []
  for (const p of planned) {
    if (a.goal !== 'stamina' && p.role !== 'main' && setsOf(kept, p.ex.muscle) + p.rx.sets > setCap(p.ex.muscle)) continue
    kept.push(p)
  }
  // 入れる種目は優先順 (kept の順) で決め、実施順だけ大きい種目から並べ替える
  const capped = sortByKind(kept)

  let groups: Planned[][] = []
  let mainBlock: Block

  if (a.goal === 'stamina') {
    const circuit = buildCircuit(a, capped, budget)
    mainBlock = circuit.block
    groups = circuit.groups
  } else {
    const forcePairs = a.goal === 'lean'
    const keepMain = a.goal === 'strength' || a.goal === 'athletic' || a.goal === 'muscle'
    const fit = (pair: boolean) => {
      for (let n = Math.min(kept.length, maxCount); n >= 1; n--) {
        const list = sortByKind(kept.slice(0, n))
        const g = pair ? pairUp(list, keepMain) : list.map(p => [p])
        if (totalSec(g, a.goal) <= budget) return g
      }
      return undefined
    }
    const singles = forcePairs ? undefined : fit(false)
    const pairs = fit(true)
    const count = (g?: Planned[][]) => g?.reduce((s, x) => s + x.length, 0) ?? 0
    groups = singles && count(singles) >= count(pairs) - 1 ? singles : pairs ?? singles ?? []

    if (groups.length === 0) {
      // 1種目すら入らない短時間: メイン種目のセット数を削って収める
      const first = { ...capped[0], rx: { ...capped[0].rx } }
      while (first.rx.sets > 2 && groupSec([first], a.goal) > budget) first.rx.sets--
      first.rx.rest = Math.min(first.rx.rest, 120)
      groups = [[first]]
    }

    // 時間が余っていれば、前の種目から順にセットを足す (メインは+2、ほかは+1まで)
    let spare = budget - totalSec(groups, a.goal)
    for (let pass = 0; pass < 2 && spare > 0; pass++) {
      for (const g of groups) {
        if (pass === 1 && g[0].role !== 'main') continue
        const flat = groups.flat()
        if (g.some(p => p.rx.sets >= 6 || p.fatigued || setsOf(flat, p.ex.muscle) + 1 > setCap(p.ex.muscle))) continue
        const before = groupSec(g, a.goal)
        g.forEach(p => (p.rx = { ...p.rx, sets: p.rx.sets + 1 }))
        const added = groupSec(g, a.goal) - before
        if (added > spare) {
          g.forEach(p => (p.rx = { ...p.rx, sets: p.rx.sets - 1 }))
          continue
        }
        spare -= added
      }
    }

    const hasPairs = groups.some(g => g.length > 1)
    mainBlock = {
      key: 'main',
      kind: 'main',
      label: 'MAIN',
      title: 'メイン',
      minutes: Math.ceil(totalSec(groups, a.goal) / 60),
      format: hasPairs
        ? '同じ記号の種目 (A1→A2) は交互に行うスーパーセット。休憩はペアの2種目目のあとに取る'
        : '1種目ずつ、決められたセット数を終えてから次の種目へ',
      items: groups.flatMap((g, gi) =>
        g.map((p, pi) => toItem(p, a, g.length > 1 ? `${letter(gi)}${pi + 1}` : letter(gi), g.length > 1 && pi === 0)),
      ),
    }
  }

  const blocks: Block[] = [mainBlock]
  if (finisher) blocks.push(finisher)
  // 筋トレで使い切れなかった時間は、回復を助ける低強度の有酸素に回す
  const spareMin = Math.floor(budget / 60) - mainBlock.minutes
  if (spareMin >= 6) blocks.push(easyCardio(Math.min(spareMin, a.minutes >= 75 ? 30 : 20), a))

  const used = groups.flat()
  const worked = [...new Set(used.flatMap(p => [p.ex.muscle, ...(p.ex.also ?? [])]))]

  // ---- トレーナーの解説 ----
  why.push(GOAL_WHY[a.goal])
  if (isAway(a.env)) {
    const gear = a.gear.length ? `手持ちの道具 (${a.gear.map(g => GEAR_LABEL[g]).join('・')})` : '道具なしの自重'
    why.push(
      `${a.env === 'home' ? '自宅' : '野外'}で${gear}でできる種目だけで組んでいます。` +
        (a.quiet ? 'ジャンプや足音の出る種目は外しました。' : '') +
        (a.env === 'outdoor' ? '床に寝る種目はタオルやレジャーシートを敷いて行いましょう。' : '') +
        (used.some(p => p.ex.equip === 'bodyweight') ? '自重種目は重さの代わりに「回数」と「ゆっくり下ろすテンポ」で負荷をかけます。' : ''),
    )
  }
  if (groups.some(g => g.length > 1) && a.goal !== 'lean' && a.goal !== 'stamina') {
    why.push(`${a.minutes}分に収めるため、部位が重ならない種目同士をスーパーセットにして休憩時間を有効活用しています。`)
  }
  if (volAdj < 0) why.push('前回「きつかった」とのことなので、メイン種目のセット数を1つ減らしています。')
  if (volAdj > 0) why.push('前回「余裕だった」とのことなので、メイン種目のセット数を1つ増やしています。')
  if (a.condition === 'tired') why.push('疲れ気味の日は、セット数を1つ減らし余力を多めに残す設定です。「休まず来た」ことがいちばんの成果です。')
  if (a.condition === 'great') why.push('調子が良い日です。最後のセットだけは記録更新を狙ってOK。ただしフォームが崩れたら止めましょう。')

  const tiredMuscles = focus.filter(m => (last[m] ?? 99) <= 1)
  if (tiredMuscles.length && !full) {
    cautions.push(
      `${musclesText(tiredMuscles)}は${agoText(Math.min(...tiredMuscles.map(m => last[m]!)))}も鍛えています。回復が追いつくよう、その部位の種目はセット数を減らしました。`,
    )
  }
  injuryCautions(a, cautions)

  const bodyweightOnly = isAway(a.env) && used.every(p => p.ex.equip === 'bodyweight')
  const next = bodyweightOnly
    ? [
        '自重トレの伸ばし方: 全セットで回数の上限までできたら、次回は「3秒かけて下ろす」「1秒止める」か、1段階難しいバリエーション (例: 膝つき → 通常 → 足を台に) に進む。',
        'できた回数をメモしておくと、前回より1回多くを狙えます。',
      ]
    : [
        a.goal === 'strength'
          ? '全セットを予定回数でこなせたら、次回はメイン種目の重量を1段階上げる。RIRが守れなければ据え置き。'
          : 'ダブルプログレッション: 全セットで回数の上限までできたら、次回は重量 (チューブなら強度) を1段階上げ、回数は下限からやり直す。',
        '使った重量・回数をメモしておくと、次回の選び方に迷いません。',
      ]
  if (!full && a.focus.length === 0) next.push('次回も「おまかせ」を選ぶと、今日鍛えていない部位を優先して組みます。')

  return {
    focus: full ? focus : focus.filter(m => worked.includes(m)),
    focusLabel: full ? '全身' : musclesText(focus.filter(m => used.some(p => p.ex.muscle === m || p.ex.also?.includes(m)))),
    blocks,
    firstMain: used.find(p => p.role === 'main' || p.role === 'power')?.ex.name,
    worked,
    exerciseIds: used.map(p => p.ex.id),
    why,
    cautions,
    next,
  }
}

const letter = (i: number) => String.fromCharCode(65 + i)

function toItem(p: Planned, a: Answers, tag: string, inPairFirst: boolean): Item {
  const unit = p.ex.unit === 'sec' ? `${HOLD_SEC[a.goal]}秒` : `${p.rx.reps}回`
  const each = p.ex.each ? ' (左右各)' : ''
  const details = [
    inPairFirst ? '休憩なしで次の種目へ' : `休憩 ${secText(p.rx.rest)}`,
    p.ex.unit === 'sec' ? 'フォームが崩れる手前まで' : rirText(p.rx.rir),
  ]
  if (p.role === 'main' && (p.ex.equip === 'barbell' || p.ex.equip === 'machine')) {
    details.push('本番の前に軽めで2セット (10回→5回) 慣らす')
  }
  if (a.goal === 'muscle' && p.role === 'iso' && a.level === 'advanced') details.push('最終セットはドロップセット (重量を2割落として限界まで)')
  if (p.fatigued) details.push('疲労が残っている部位なので控えめに')
  if (p.tempo) details.push('3秒かけて戻し、いちばんきつい位置で1秒止める (自重でも筋力に効かせる)')
  // 1RMからの重量計算は、重量を細かく管理する目的のときだけ出す
  const usesPercent = a.goal === 'strength' || a.goal === 'muscle' || a.goal === 'athletic'
  const pct = usesPercent && p.ex.lift && (p.role === 'main' || p.role === 'compound') ? percentFor(p.rx.n, p.rx.rir) : undefined
  return {
    id: p.ex.id,
    name: p.ex.name,
    en: p.ex.en,
    prescription: `${p.rx.sets}セット × ${unit}${each}`,
    sets: p.rx.sets,
    detail: details.join(' / '),
    tag,
    restSec: inPairFirst ? undefined : p.rx.rest,
    cues: p.ex.cues,
    swappable: true,
    percent: pct && p.ex.lift ? { lift: p.ex.lift, lo: pct[0], hi: pct[1] } : undefined,
  }
}

/** スタミナ目的: 40秒動いて20秒で移動するサーキット */
function buildCircuit(a: Answers, planned: Planned[], budget: number) {
  const workS = a.level === 'beginner' || a.condition === 'tired' ? 30 : 40
  const restS = 60 - workS
  const roundRestS = 60
  let stations = Math.min(planned.length, a.minutes <= 30 ? 4 : a.minutes <= 60 ? 6 : 8)
  let rounds = 0
  while (stations >= 3) {
    rounds = Math.floor((budget + roundRestS) / (stations * 60 + roundRestS))
    if (rounds >= 2) break
    stations--
  }
  rounds = clamp(rounds, 1, 6)
  const list = planned.slice(0, stations)
  const steps: { label: string; seconds: number }[] = []
  for (let r = 1; r <= rounds; r++) {
    list.forEach((p, i) => {
      steps.push({ label: `R${r} ${p.ex.name}`, seconds: workS })
      steps.push({ label: i === list.length - 1 ? (r === rounds ? '終了!' : 'ラウンド間の休憩') : `次: ${list[i + 1].ex.name}`, seconds: i === list.length - 1 ? (r === rounds ? 0 : roundRestS) : restS })
    })
  }
  const block: Block = {
    key: 'main',
    kind: 'main',
    label: 'CIRCUIT',
    title: `サーキット ${rounds}ラウンド`,
    minutes: Math.ceil((rounds * stations * 60 + (rounds - 1) * roundRestS) / 60),
    format: `各種目${workS}秒動いて${restS}秒で次へ移動。全種目で1ラウンド、ラウンド間は60秒休憩`,
    items: list.map((p, i) => ({
      id: p.ex.id,
      name: p.ex.name,
      en: p.ex.en,
      prescription: p.ex.unit === 'sec' ? `${workS}秒キープ` : `${workS}秒 動き続ける${p.ex.each ? ' (左右交互)' : ''}`,
      sets: rounds,
      detail:
        p.ex.unit === 'sec'
          ? 'フォームが崩れたら膝をついて続ける'
          : p.ex.equip === 'bodyweight'
            ? `${workS}秒でできるだけ多く。息が上がっても止まらないペースで`
            : `${workS}秒で12〜15回できる重さで。息が上がっても止まらないペースで`,
      tag: String(i + 1),
      cues: p.ex.cues,
      swappable: true,
    })),
    timer: { type: 'guided', steps: steps.filter(s => s.seconds > 0) },
    tips: ['1ラウンド目は抑えめに。全ラウンドで同じ回数を保てるのが理想', '動けなくなったら30秒休んでOK。止まらないことより、やり切ることを優先'],
  }
  return { block, groups: list.map(p => [p]) }
}

function planFinisher(a: Answers, rng: Rng): Block | undefined {
  const B = a.minutes - BOOKEND_MIN
  const tired = a.condition === 'tired'
  if (a.goal === 'lean') {
    const min = a.minutes <= 20 ? 4 : a.minutes >= 60 ? 8 : 6
    if (tired || (min >= 8 && rng() < 0.4)) return steady(min, '脂肪燃焼ゾーン', a)
    return intervals(min, a.level === 'beginner' ? [30, 30] : [20, 40], 'HIIT', a)
  }
  if (a.goal === 'stamina') {
    const min = clamp(Math.round((B * 0.3) / 2) * 2, 6, 16)
    return intervals(min, [60, 60], 'インターバル', a)
  }
  if (a.goal === 'athletic' && a.minutes >= 45) return intervals(6, [10, 50], 'スプリント', a)
  if (a.goal === 'health' && a.minutes >= 45) return steady(a.minutes >= 75 ? 12 : 8, '有酸素', a)
  return undefined
}

export const GOAL_WHY: Record<Goal, string> = {
  lean: '引き締めの近道は「筋肉を落とさずに消費を増やす」こと。休憩の短いスーパーセットで心拍を保ち、最後のフィニッシャーで脂肪燃焼を後押しします。',
  muscle: '筋肉を大きくするのは「限界近くまで追い込んだセットの総量」。8〜15回で余力1〜2回まで追い込み、同じ部位を複数の角度から刺激します。',
  strength: '強くなるには、重い重量を正しいフォームで扱う経験を積むこと。低回数・長めの休憩で、毎セットの質を最優先にしています。',
  stamina: 'スタミナは「心拍が上がった状態で動き続ける時間」で伸びます。休憩の短いサーキットとインターバルで、心肺と筋持久力を同時に鍛えます。',
  athletic: '動ける体には「速く力を出す能力」が欠かせません。疲れる前の最初にパワー種目を置き、そのあと土台となる筋力を鍛えます。',
  health: '健康と姿勢のために、背中・お尻・体幹など姿勢を支える筋肉を中心に、余力を残す強度で組んでいます。続けられることが何よりの効果です。',
}

export function injuryCautions(a: Answers, cautions: string[]) {
  const map: Record<string, string> = {
    lowback: 'デッドリフトやベントオーバーロウなど、腰が丸まりやすい・反りやすい種目を外しています。',
    knee: 'スクワット・ランジ・ジャンプなど、ひざへの負担が大きい種目を外しています。',
    shoulder: '頭上へ押す種目や懸垂・ディップスなど、肩に負担が大きい種目を外しています。',
    wrist: 'プッシュアップやバーベルプレスなど、手首を強く反らす種目を外しています。',
  }
  a.injuries.forEach(i => cautions.push(map[i]))
  if (a.injuries.length) cautions.push('痛みが出たらその種目は中止し、続く場合は医療機関・専門家に相談してください。')
}

/** 施設型ジム・自宅・野外の種目を、同じ枠の別の種目に入れ替える */
export function gymAlternative(id: string, a: Answers, exclude: Set<string>, rng: Rng): GymExercise | undefined {
  const cur = GYM_BY_ID.get(id)
  if (!cur) return undefined
  const lvl = LEVEL_NUM[a.level]
  const ok = (e: GymExercise) => e.level <= lvl && !exclude.has(e.id) && !e.avoid.some(i => a.injuries.includes(i)) && availableFor(e, a)
  const same = GYM_EXERCISES.filter(e => e.slot === cur.slot && ok(e))
  const fallback = GYM_EXERCISES.filter(e => e.muscle === cur.muscle && e.kind === cur.kind && ok(e))
  const pool = same.length ? same : fallback
  return weighted(rng, pool, () => 1)
}

