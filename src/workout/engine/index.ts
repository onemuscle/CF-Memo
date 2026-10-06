import { BOOKEND_MIN, EMPTY_CONTEXT, contextOf, type GenContext } from './common'
import { boxAlternative, buildBox } from './box'
import { BOX_MOVEMENTS, LIFTS } from './crossfit'
import { GYM_EXERCISES } from './exercises'
import { gymAlternative, buildGym } from './gym'
import { ENV_LABEL, GOAL_LABEL, GOAL_SHORT, MUSCLES } from './labels'
import { makeRng } from './rng'
import type { Answers, Condition, Env, Gear, Goal, HistoryEntry, Injury, Level, Muscle, Rating, Scale, Workout } from './types'
import { buildCooldown, buildWarmup } from './warmup'

export * from './types'
export { contextOf, EMPTY_CONTEXT, type GenContext }

/**
 * 回答・シード・履歴の要約 (GenContext) からその日のメニューを作る。
 * 同じ入力なら必ず同じメニューになる (共有URLで再現するため)。
 */
export function generateWorkout(a: Answers, seed: number, gen: GenContext = EMPTY_CONTEXT): Workout {
  const rng = makeRng(seed)
  const body = a.env === 'box' ? buildBox(a, rng, gen) : buildGym(a, rng, gen)

  const warmFocus = body.focus.length ? body.focus : body.worked
  const warmup = buildWarmup({ env: a.env, focus: warmFocus, injuries: a.injuries, quiet: a.quiet, rng, firstMain: body.firstMain })
  const cooldown = buildCooldown({ focus: warmFocus, worked: body.worked, injuries: a.injuries, rng })
  const blocks = [warmup, ...body.blocks, cooldown]
  const total = blocks.reduce((s, b) => s + b.minutes, 0)

  const boxBody = 'wodName' in body ? (body as ReturnType<typeof buildBox>) : undefined
  const wodName = boxBody?.wodName
  const focusLabel = body.focusLabel || '全身'

  const why = [...body.why]
  if (total < a.minutes - 3) {
    why.push(`今日の内容は約${total}分で終わる設計です。量を詰め込みすぎないのも上達のコツ。余った時間はストレッチや次回の準備に。`)
  }

  return {
    id: `${seed.toString(36)}-${Date.now().toString(36)}`,
    seed,
    createdAt: Date.now(),
    answers: a,
    context: gen,
    focus: body.focus,
    focusLabel,
    title: a.env === 'box' ? `WOD "${wodName}"` : `${focusLabel}の日`,
    subtitle:
      a.env === 'box'
        ? `${boxBody?.subtitle} / ${focusLabel}`
        : `${GOAL_SHORT[a.goal]}メニュー${a.env === 'gym' ? '' : ` · ${ENV_LABEL[a.env]}`}`,
    wodName,
    blocks,
    totalMinutes: total,
    why,
    cautions: body.cautions,
    next: body.next,
  }
}

/** 履歴 (新しい順) を考慮してメニューを作る */
export function generateForToday(a: Answers, seed: number, history: HistoryEntry[], now = new Date()): Workout {
  return generateWorkout(a, seed, contextOf(history, now))
}

/** 種目を入れ替えた新しいメニューを返す (入れ替えられなければ undefined) */
export function swapItem(w: Workout, blockKey: string, index: number, seed: number): Workout | undefined {
  const block = w.blocks.find(b => b.key === blockKey)
  const item = block?.items[index]
  if (!block || !item?.swappable) return undefined
  const exclude = new Set(w.blocks.flatMap(b => b.items.map(i => i.id)))
  const rng = makeRng(seed)
  const alt =
    w.answers.env === 'box' && blockKey === 'accessory'
      ? boxAlternative(item.id, w.answers, exclude, rng)
      : gymAlternative(item.id, w.answers, exclude, rng)
  if (!alt) return undefined

  // 回数表記は元の種目のまま、左右の表記だけ合わせる
  let prescription = item.prescription.replace(/ \(左右各\)| \(左右交互\)/, '')
  if (alt.each) prescription += block.label === 'CIRCUIT' ? ' (左右交互)' : ' (左右各)'
  const replaced = {
    ...item,
    id: alt.id,
    name: alt.name,
    en: alt.en,
    cues: alt.cues,
    prescription,
    percent: item.percent && alt.lift ? { ...item.percent, lift: alt.lift } : undefined,
  }
  return {
    ...w,
    blocks: w.blocks.map(b =>
      b.key === blockKey ? { ...b, items: b.items.map((it, i) => (i === index ? replaced : it)) } : b,
    ),
  }
}

/** 実際に鍛えた部位 (履歴に保存する) */
export function workedMuscles(w: Workout): Muscle[] {
  return w.focusLabel === '全身' ? [...MUSCLES] : w.focus
}

export function exerciseIds(w: Workout): string[] {
  return w.blocks
    .filter(b => b.kind !== 'warmup' && b.kind !== 'cooldown')
    .flatMap(b => b.items.map(i => i.id))
    .filter(id => ID_TO_CODE.has(id))
}

// ---------------- 共有URL ----------------
// 回答・シード・履歴の要約を短い文字列にする。例: 0.1.cb.45.1.1.x.0.k3x9z.1x2xxxx...
// 履歴の要約 = 前回の評価(1文字) + 部位ごとの経過日数(7文字) + 直近の種目(ID 3文字 + 日数 1文字 ずつ)

// 末尾にだけ追加する (並びを変えると古い共有URLが別の内容になる)
const ENVS: Env[] = ['gym', 'box', 'home', 'outdoor']
const GEAR_CODE: Record<Gear, string> = { dumbbell: 'd', band: 't', kettlebell: 'k', bar: 'b', bench: 'c', stairs: 's' }
const GOALS: Goal[] = ['lean', 'muscle', 'strength', 'stamina', 'athletic', 'health']
const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced']
const CONDS: Condition[] = ['great', 'normal', 'tired']
const INJ: Injury[] = ['lowback', 'knee', 'shoulder', 'wrist']
const SCALES: Scale[] = ['men', 'women']
const RATINGS: Rating[] = ['easy', 'good', 'hard']
const MUSCLE_CODE: Record<Muscle, string> = { chest: 'c', back: 'b', shoulders: 's', arms: 'a', core: 'o', glutes: 'g', legs: 'l' }

/** 種目IDを3文字にする (種目を追加・並べ替えても古いURLが壊れないよう、並び順ではなくハッシュで) */
function idCode(id: string): string {
  let h = 5381
  for (const ch of id) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0
  return (h % 46656).toString(36).padStart(3, '0')
}

const ALL_IDS = [...new Set([...GYM_EXERCISES.map(e => e.id), ...BOX_MOVEMENTS.map(m => m.id), ...LIFTS.map(l => l.id)])]
const ID_TO_CODE = new Map(ALL_IDS.map(id => [id, idCode(id)]))
const CODE_TO_ID = new Map(ALL_IDS.map(id => [idCode(id), id]))

function encodeContext(gen: GenContext): string {
  const rating = gen.rating ? String(RATINGS.indexOf(gen.rating)) : 'x'
  const ago = MUSCLES.map(m => (gen.ago[m] === undefined ? 'x' : String(Math.min(9, gen.ago[m]!)))).join('')
  const used = Object.entries(gen.used)
    .filter(([id]) => ID_TO_CODE.has(id))
    .map(([id, d]) => `${ID_TO_CODE.get(id)}${Math.min(9, d)}`)
    .join('')
  return rating + ago + used
}

function decodeContext(s: string): GenContext | undefined {
  if (s.length < 8 || (s.length - 8) % 4 !== 0) return undefined
  const rating = s[0] === 'x' ? undefined : RATINGS[Number(s[0])]
  const ago: GenContext['ago'] = {}
  MUSCLES.forEach((m, i) => {
    if (s[1 + i] !== 'x') ago[m] = Number(s[1 + i])
  })
  const used: GenContext['used'] = {}
  for (let i = 8; i < s.length; i += 4) {
    const id = CODE_TO_ID.get(s.slice(i, i + 3))
    if (id) used[id] = Number(s[i + 3])
  }
  return { rating, ago, used }
}

export function encodeShare(a: Answers, seed: number, gen: GenContext = EMPTY_CONTEXT): string {
  const parts = [
    ENVS.indexOf(a.env),
    GOALS.indexOf(a.goal),
    a.focus.map(m => MUSCLE_CODE[m]).join('') || 'x',
    a.minutes,
    LEVELS.indexOf(a.level),
    CONDS.indexOf(a.condition),
    a.injuries.map(i => INJ.indexOf(i)).join('') || 'x',
    // 重量基準の数字の後ろに、道具 (英字) と「静かに」(q) を続ける
    `${SCALES.indexOf(a.scale)}${a.gear.map(g => GEAR_CODE[g]).join('')}${a.quiet ? 'q' : ''}`,
    seed.toString(36),
  ].join('.')
  const ctx = encodeContext(gen)
  return ctx === 'x' + 'x'.repeat(MUSCLES.length) ? parts : `${parts}.${ctx}`
}

export function decodeShare(code: string): { answers: Answers; seed: number; context: GenContext } | undefined {
  const p = code.split('.')
  if (p.length !== 9 && p.length !== 10) return undefined
  const env = ENVS[Number(p[0])]
  const goal = GOALS[Number(p[1])]
  const focus = p[2] === 'x' ? [] : [...p[2]].map(c => MUSCLES.find(m => MUSCLE_CODE[m] === c)).filter((m): m is Muscle => !!m)
  const minutes = Number(p[3])
  const level = LEVELS[Number(p[4])]
  const condition = CONDS[Number(p[5])]
  const injuries = p[6] === 'x' ? [] : [...p[6]].map(c => INJ[Number(c)]).filter(Boolean)
  const scale = SCALES[Number(p[7][0])]
  const gear = [...p[7].slice(1)].map(c => (Object.keys(GEAR_CODE) as Gear[]).find(g => GEAR_CODE[g] === c)).filter((g): g is Gear => !!g)
  const quiet = p[7].includes('q')
  const seed = parseInt(p[8], 36)
  const context = p[9] ? decodeContext(p[9]) : EMPTY_CONTEXT
  if (!env || !goal || !level || !condition || !scale || !context || !Number.isFinite(seed) || !(minutes >= 15 && minutes <= 120)) {
    return undefined
  }
  return { answers: { env, goal, focus, minutes, level, condition, injuries, scale, gear, quiet }, seed, context }
}

/** いま表示しているメニューの共有コード */
export function shareCode(w: Workout): string {
  return encodeShare(w.answers, w.seed, w.context ?? EMPTY_CONTEXT)
}

/** シェア用のテキスト */
export function shareText(w: Workout): string {
  const a = w.answers
  return `今日のメニュー: ${w.title} (${ENV_LABEL[a.env]}・${a.minutes}分・${GOAL_LABEL[a.goal]})`
}

export { BOOKEND_MIN }
