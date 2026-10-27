// 食事の目安。基礎代謝 (Mifflin-St Jeor 式) × 普段の活動量 + その日のトレーニング消費から、
// 目的に合わせてカロリーと P/F/C を決め、食事回数とトレーニングの時間帯に合わせて配分する。

import type { Goal, Level } from '../../workout/engine'
import { bmi, weightDirection, type Profile, type TrainTime } from '../profile'
import type { Session, SessionType } from './plan'

export interface Targets {
  kcal: number
  p: number
  f: number
  c: number
}

const ACTIVITY_FACTOR: Record<Profile['activity'], number> = { low: 1.3, mid: 1.45, high: 1.6 }

/** 1時間あたりのMETs (安静の1METを引いて、トレーニングで上乗せされる分だけ数える) */
const SESSION_MET: Record<SessionType, number> = {
  strength: 5,
  crossfit: 8,
  cardio: 6,
  hiit: 8,
  rest: 1,
  review: 1,
}

const PROTEIN_PER_KG: Record<Goal, number> = {
  lean: 2.0,
  muscle: 1.8,
  strength: 1.8,
  athletic: 1.6,
  stamina: 1.4,
  health: 1.2,
}

/** 増量のペース (体重に対する1週間あたりの割合) */
const GAIN_RATE: Record<Level, number> = { beginner: 0.0035, intermediate: 0.0025, advanced: 0.0015 }
const LOSS_RATE = 0.005
/** 体脂肪 1kg ≒ 7200kcal */
const KCAL_PER_KG = 7200

export function bmrOf(p: Profile): number {
  const base = 10 * p.weight + 6.25 * p.height - 5 * p.age
  // 回答しない場合は男女の中間
  return base + (p.sex === 'male' ? 5 : p.sex === 'female' ? -161 : -78)
}

/** その日のトレーニングで上乗せされる消費カロリー */
export function sessionKcal(p: Profile, s: Session): number {
  const minutes = s.type === 'hiit' ? Math.min(p.minutes, 30) : p.minutes
  return Math.round((SESSION_MET[s.type] - 1) * p.weight * (minutes / 60))
}

/** 体重の変化ペース (kg / 週)。減量はマイナス。目標体重に届いたら 0 */
export function weeklyRate(p: Profile): number {
  const dir = weightDirection(p.goal)
  if (dir === 'down') {
    // やせ型 (BMI 18.5未満) では減量しない
    if (bmi(p) < 18.5) return 0
    if (p.targetWeight !== undefined && p.targetWeight >= p.weight) return 0
    return -round1(p.weight * LOSS_RATE)
  }
  if (dir === 'up') {
    if (p.targetWeight !== undefined && p.targetWeight <= p.weight) return 0
    return round2(p.weight * GAIN_RATE[p.level])
  }
  return 0
}

/** 週 week (1 始まり) を終えた時点の目安体重 */
export function weightAt(p: Profile, week: number): number {
  const rate = weeklyRate(p)
  let w = p.weight + rate * week
  if (p.targetWeight !== undefined) {
    if (rate < 0) w = Math.max(w, p.targetWeight)
    if (rate > 0) w = Math.min(w, p.targetWeight)
  }
  return round1(w)
}

/** 目標体重に届く見込みの週 (届かなければ undefined) */
export function weeksToTarget(p: Profile): number | undefined {
  const rate = weeklyRate(p)
  if (!rate || p.targetWeight === undefined) return undefined
  return Math.ceil(Math.abs(p.targetWeight - p.weight) / Math.abs(rate))
}

/** 普段の生活での消費 (トレーニングなし) */
export function baseKcal(p: Profile): number {
  return bmrOf(p) * ACTIVITY_FACTOR[p.activity]
}

/** 目的による1日あたりの増減 (kcal) */
export function goalAdjust(p: Profile): number {
  const rate = weeklyRate(p)
  if (rate < 0) {
    // 1日の不足は維持カロリーの20%まで
    return -Math.min((Math.abs(rate) * KCAL_PER_KG) / 7, baseKcal(p) * 0.2)
  }
  if (rate > 0) return (rate * KCAL_PER_KG) / 7
  return p.goal === 'strength' ? 100 : 0
}

/** タンパク質の基準にする体重 (BMI 27を超える場合は、標準体重寄りで計算して過剰にしない) */
function proteinWeight(p: Profile): number {
  const m = p.height / 100
  return bmi(p) > 27 ? 25 * m * m : p.weight
}

export function targetsFor(p: Profile, s: Session): Targets {
  const raw = baseKcal(p) + sessionKcal(p, s) + goalAdjust(p)
  // 基礎代謝を下回らない
  const kcal = round50(Math.max(raw, bmrOf(p)))
  const pr = round5(proteinWeight(p) * PROTEIN_PER_KG[p.goal])
  const f = round5(Math.max((kcal * 0.25) / 9, p.weight * 0.6))
  const c = round5(Math.max(50, (kcal - pr * 4 - f * 9) / 4))
  return { kcal, p: pr, f, c }
}

// ---------------------------------------------------------------- 1日の配分

export interface MealSlot {
  time: string
  name: string
  /** トレーニング前 / 後の食事 */
  role?: 'pre' | 'post'
  kind: 'meal' | 'snack'
  p: number
  f: number
  c: number
  /** 「鶏むね肉 150g / ご飯 200g」のような例 */
  example: string
  tip?: string
}

export interface DayMeals {
  slots: MealSlot[]
  /** トレーニングを入れる時刻 (休養日は undefined) */
  trainAt?: string
  /** トレ前に食事が入らない日の補食の案内 */
  preTip?: string
}

const TRAIN_AT: Record<TrainTime, string> = {
  morning: '06:30',
  noon: '12:00',
  evening: '18:00',
  night: '20:30',
}

type SlotDef = { time: string; name: string; kind: 'meal' | 'snack' }

/** 食事回数 × 時間帯ごとの食事の時刻 */
function slotDefs(meals: Profile['meals'], t: TrainTime): SlotDef[] {
  const main: Record<TrainTime, SlotDef[]> = {
    morning: [
      { time: '08:00', name: '朝食', kind: 'meal' },
      { time: '12:30', name: '昼食', kind: 'meal' },
      { time: '19:00', name: '夕食', kind: 'meal' },
    ],
    noon: [
      { time: '07:30', name: '朝食', kind: 'meal' },
      { time: '13:00', name: '昼食', kind: 'meal' },
      { time: '19:30', name: '夕食', kind: 'meal' },
    ],
    evening: [
      { time: '07:30', name: '朝食', kind: 'meal' },
      { time: '12:30', name: '昼食', kind: 'meal' },
      { time: '19:30', name: '夕食', kind: 'meal' },
    ],
    night: [
      { time: '07:30', name: '朝食', kind: 'meal' },
      { time: '12:30', name: '昼食', kind: 'meal' },
      { time: '18:30', name: '夕食', kind: 'meal' },
    ],
  }
  const snacks: Record<TrainTime, string[]> = {
    morning: ['15:30', '10:30'],
    noon: ['10:30', '16:00'],
    evening: ['16:30', '10:00'],
    night: ['22:00', '16:00'],
  }
  const list = [...main[t]]
  snacks[t].slice(0, meals - 3).forEach(time => list.push({ time, name: '間食', kind: 'snack' }))
  return list.sort((a, b) => a.time.localeCompare(b.time))
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function dayMeals(p: Profile, s: Session, t: Targets): DayMeals {
  const training = s.type !== 'rest' && s.type !== 'review'
  const defs = slotDefs(p.meals, p.trainTime)
  const trainAt = training ? TRAIN_AT[p.trainTime] : undefined
  const tm = trainAt ? minutesOf(trainAt) : -1

  // トレ前 = 開始の1〜4時間前で最も近い食事 / トレ後 = 終了後3時間以内で最も近い食事
  const end = tm + p.minutes
  const pre = training ? [...defs].reverse().find(d => tm - minutesOf(d.time) >= 60 && tm - minutesOf(d.time) <= 240) : undefined
  const post = training ? defs.find(d => minutesOf(d.time) >= end && minutesOf(d.time) - end <= 180) : undefined

  const weight = (d: SlotDef, role?: 'pre' | 'post') => ({
    p: d.kind === 'snack' ? (role === 'post' ? 1 : 0.6) : 1,
    // 炭水化物はトレーニングの前後に寄せる
    c: (d.kind === 'snack' ? 0.5 : 1) * (role ? 1.5 : 1),
    // 脂質は消化が遅いのでトレーニングの前後は控えめに
    f: (d.kind === 'snack' ? 0.6 : 1) * (role ? 0.6 : 1),
  })
  const roles = defs.map(d => (d === pre ? 'pre' : d === post ? 'post' : undefined) as MealSlot['role'])
  const ws = defs.map((d, i) => weight(d, roles[i]))
  const sum = (k: 'p' | 'f' | 'c') => ws.reduce((a, w) => a + w[k], 0)
  const total = { p: sum('p'), f: sum('f'), c: sum('c') }

  const slots: MealSlot[] = defs.map((d, i) => {
    const role = roles[i]
    const p_ = round5((t.p * ws[i].p) / total.p)
    const f_ = round5((t.f * ws[i].f) / total.f)
    const c_ = round5((t.c * ws[i].c) / total.c)
    return {
      ...d,
      role,
      p: p_,
      f: f_,
      c: c_,
      example: exampleFor(d, role, p_, c_),
      tip:
        role === 'pre'
          ? '消化の良い炭水化物を中心に。揚げ物・脂の多い肉はトレ後に回す'
          : role === 'post'
            ? 'トレーニング後はタンパク質と炭水化物をセットで。回復が早まる'
            : undefined,
    }
  })

  let preTip: string | undefined
  if (training && !pre) {
    preTip =
      p.trainTime === 'morning'
        ? '朝トレは空腹のままより、バナナ1本やゼリー飲料で糖質を少し入れてから始めると動けます'
        : 'トレ前の食事が空きすぎる日は、1時間前におにぎり1個かバナナ1本を足すと最後までバテにくい'
  }
  return { slots, trainAt, preTip }
}

/** 食材の目安量に置き換える */
function exampleFor(d: SlotDef, role: MealSlot['role'], p: number, c: number): string {
  const parts: string[] = []
  // タンパク質の7割をメインの食材で、残りは主食・副菜からとる想定
  const main = p * 0.7
  if (d.kind === 'snack') {
    if (role === 'post' || p >= 20) parts.push(`プロテイン ${Math.max(1, Math.round(main / 20))}杯`)
    else parts.push(`ギリシャヨーグルト ${round10((main / 10) * 100)}g`)
    if (c >= 15) parts.push(c >= 35 ? `おにぎり ${Math.round(c / 40) || 1}個` : 'バナナ 1本')
    return parts.join(' / ')
  }
  if (d.name === '朝食') {
    // 卵は3個まで。残りはヨーグルトで
    const eggs = Math.max(1, Math.min(3, Math.round(main / 6.2)))
    parts.push(`卵 ${eggs}個`)
    const rest = main - eggs * 6.2
    if (rest >= 5) parts.push(`ギリシャヨーグルト ${round10((rest / 10) * 100)}g`)
    if (c >= 20) parts.push(c >= 70 ? `ご飯 ${round10(c / 0.37)}g` : `オートミール ${round10(c / 0.6)}g`)
  } else {
    const protein = d.name === '昼食' ? { name: '鶏むね肉 (皮なし)', per: 23 } : { name: '魚か赤身肉', per: 21 }
    parts.push(`${protein.name} ${round10((main / protein.per) * 100)}g`)
    if (c >= 20) parts.push(`ご飯 ${round10(c / 0.37)}g`)
  }
  parts.push('野菜・海藻')
  return parts.join(' / ')
}

// ---------------------------------------------------------------- 丸め

const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100
const round5 = (n: number) => Math.round(n / 5) * 5
const round10 = (n: number) => Math.max(10, Math.round(n / 10) * 10)
const round50 = (n: number) => Math.round(n / 50) * 50

/** 食材の置き換え早見表 */
export const SWAP_TABLE: { label: string; items: string[] }[] = [
  {
    label: 'タンパク質 20g',
    items: ['鶏むね肉 (皮なし) 90g', 'ツナ水煮缶 1.5缶', '卵 3個', 'ギリシャヨーグルト 200g', '納豆 2.5パック', 'プロテイン 1杯'],
  },
  {
    label: '炭水化物 50g',
    items: ['ご飯 135g (小盛り1杯)', 'オートミール 80g', '食パン6枚切り 2枚', 'バナナ 2本', 'うどん (ゆで) 1玉弱', 'おにぎり 1.2個'],
  },
  {
    label: '脂質 10g',
    items: ['オリーブオイル 小さじ2', 'アーモンド 15粒', 'アボカド 1/2個', 'ミックスナッツ 一握り', '鮭 1切れ', '卵黄 2個分'],
  },
]
