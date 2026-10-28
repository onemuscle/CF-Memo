// プランの1日ぶんのメニュー。筋トレ・CrossFit の日はきょうトレのエンジンで作り、
// 有酸素の日は同じエンジンの有酸素ブロックで組む。
// 前の日までのメニューを「履歴」として渡すので、同じ種目・部位が続きすぎない。

import { parseISO, shiftDate } from '../../plan/plan'
import {
  contextOf,
  exerciseIds,
  generateWorkout,
  shareCode,
  workedMuscles,
  type Answers,
  type Block,
  type Condition,
  type HistoryEntry,
  type Workout,
} from '../../workout/engine'
import { easyCardio, intervals, steady } from '../../workout/engine/cardio'
import { makeRng } from '../../workout/engine/rng'
import { buildCooldown } from '../../workout/engine/warmup'
import type { Profile } from '../profile'
import { dayPlan, isTraining, type DayPlan, type Plan, type Session } from './plan'

export interface DayWorkout {
  title: string
  subtitle: string
  blocks: Block[]
  totalMinutes: number
  why: string[]
  cautions: string[]
  next: string[]
  /** エンジンで作ったメニュー (きょうトレのタイマーで開ける) */
  engine?: Workout
  /** きょうトレの共有コード */
  share?: string
}

/** その日の体調。auto = フェーズの既定値 (導入・ディロードは控えめ、強化は攻める) */
export type DayCondition = 'auto' | Condition

export function answersFor(p: Profile, s: Session, condition: Condition): Answers {
  return {
    env: s.env,
    goal: p.goal,
    focus: s.type === 'crossfit' ? [] : s.focus,
    minutes: p.minutes,
    level: p.level,
    condition,
    injuries: p.injuries,
    scale: p.sex === 'female' ? 'women' : 'men',
    gear: s.env === 'home' || s.env === 'outdoor' ? p.gear : [],
    quiet: s.env === 'home' && p.quiet,
    style: s.env === 'gym' ? (p.gymStyle ?? 'hybrid') : undefined,
  }
}

function hash(text: string): number {
  let h = 2166136261
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  return h % 2147483647 || 1
}

function seedFor(p: Profile, date: string, variant: number): number {
  return hash(`${p.createdAt}:${date}:${variant}`)
}

// ---------------------------------------------------------------- 履歴 (前の日までのメニュー)

/** プランごとの「既定のメニュー」のキャッシュ。前日までの内容を次の日の生成に使う */
const cache = new WeakMap<Plan, Map<string, Workout | null>>()

function baseWorkout(plan: Plan, date: string): Workout | null {
  let map = cache.get(plan)
  if (!map) {
    map = new Map()
    cache.set(plan, map)
  }
  if (map.has(date)) return map.get(date)!
  const day = dayPlan(plan, date)
  let w: Workout | null = null
  if (day && (day.session.type === 'strength' || day.session.type === 'crossfit')) {
    w = engineWorkout(plan, day, day.phase.condition, 0)
  }
  map.set(date, w)
  return w
}

/** 前の8日間に組んだメニューを、新しい順の履歴にする */
function historyBefore(plan: Plan, date: string): HistoryEntry[] {
  const out: HistoryEntry[] = []
  for (let i = 1; i <= 8; i++) {
    const d = shiftDate(date, -i)
    if (d < plan.start) break
    const w = baseWorkout(plan, d)
    if (!w) continue
    out.push({
      id: d,
      date: d,
      doneAt: 0,
      title: w.title,
      env: w.answers.env,
      goal: w.answers.goal,
      muscles: workedMuscles(w),
      exerciseIds: exerciseIds(w),
      minutes: w.totalMinutes,
    })
  }
  return out
}

function engineWorkout(plan: Plan, day: DayPlan, condition: Condition, variant: number): Workout {
  const p = plan.profile
  const answers = answersFor(p, day.session, condition)
  const ctx = contextOf(historyBefore(plan, day.date), parseISO(day.date))
  return generateWorkout(answers, seedFor(p, day.date, variant), ctx)
}

// ---------------------------------------------------------------- 1日ぶん

export function dayWorkout(plan: Plan, day: DayPlan, cond: DayCondition, variant: number): DayWorkout | null {
  const s = day.session
  if (!isTraining(s)) return null
  const condition = cond === 'auto' ? day.phase.condition : cond
  if (s.type === 'cardio' || s.type === 'hiit') return cardioWorkout(plan.profile, day, condition, variant)

  const w =
    cond === 'auto' && variant === 0 ? baseWorkout(plan, day.date)! : engineWorkout(plan, day, condition, variant)

  // フェーズで体調を決めた日は、エンジンの「疲れ気味」「絶好調」の説明をフェーズの説明に置き換える
  const why = cond === 'auto' ? w.why.filter(t => !/^(疲れ気味|調子が良い日)/.test(t)) : [...w.why]
  if (cond === 'auto' && day.phase.condition !== 'normal') why.unshift(`${day.phase.label}の週: ${day.phase.aim}。`)

  return {
    title: s.type === 'crossfit' ? w.title : `${s.label}の日`,
    subtitle: s.type === 'crossfit' ? w.subtitle : `${w.focusLabel} · ${w.subtitle}`,
    blocks: w.blocks,
    totalMinutes: w.totalMinutes,
    why,
    cautions: w.cautions,
    next: w.next,
    engine: w,
    share: shareCode(w),
  }
}

function cardioWorkout(p: Profile, day: DayPlan, condition: Condition, variant: number): DayWorkout {
  const s = day.session
  const where = { env: s.env, gear: p.gear, quiet: s.env === 'home' && p.quiet, injuries: p.injuries }
  const rng = makeRng(seedFor(p, day.date, variant))
  const cooldown = buildCooldown({ focus: ['legs', 'glutes'], worked: ['legs', 'glutes', 'core'], injuries: p.injuries, rng })
  const scale = day.phase.cardioScale * (condition === 'tired' ? 0.75 : condition === 'great' ? 1.1 : 1)
  const why: string[] = []
  const cautions: string[] = []
  let blocks: Block[]

  if (s.type === 'hiit') {
    // 4分のゆっくり → インターバル → ストレッチ。インターバル部分は8〜20分
    const budget = Math.min(p.minutes, 35) - 4 - cooldown.minutes
    const work = Math.max(8, Math.min(20, Math.round((budget * scale) / 2) * 2))
    const onOff: [number, number] = p.goal === 'stamina' ? [60, 60] : p.level === 'advanced' ? [20, 40] : [30, 60]
    const warm = { ...easyCardio(4, where), key: 'warmup', kind: 'warmup' as const, label: 'WARM-UP', title: 'ゆっくり体を温める 4分' }
    blocks = [warm, { ...intervals(work, onOff, 'インターバル', where), key: 'main', label: 'MAIN' }, cooldown]
    why.push(
      '短いハードと休みを繰り返すインターバルは、短時間で心肺機能を大きく伸ばし、トレーニング後もしばらく代謝が上がった状態が続きます。',
      'ハードの区間は「会話できない」強度まで上げ、休みの区間は止まらずに動き続けると回復が早まります。',
    )
    if (condition === 'tired') why.push('疲れ気味なので本数を減らしています。きつければ全部を「ゆったり有酸素」に切り替えてOKです。')
    cautions.push('前後の日に脚の高強度トレーニングが重なる場合は、ハードの強度を8割に抑える')
  } else {
    // 調子が良い日に延ばしても、ストレッチ込みで選んだ時間に収める
    const cap = Math.min(60, Math.floor((p.minutes - cooldown.minutes) / 5) * 5)
    const min = Math.max(15, Math.min(cap, Math.round((p.minutes * scale - cooldown.minutes) / 5) * 5))
    const main =
      p.goal === 'lean' && condition !== 'tired'
        ? { ...steady(min, '脂肪燃焼ゾーン', where), key: 'main', label: 'MAIN' }
        : { ...easyCardio(min, where), key: 'main', label: 'MAIN' }
    blocks = [main, cooldown]
    why.push(
      '会話ができる強度の有酸素は、脂肪を燃料に使う力と心肺の土台を作ります。筋トレの疲労回復も早めてくれます。',
      `${day.phase.label}の週なので約${min}分。強化の週ほど長く、導入・ディロードの週は短くしています。`,
    )
  }
  if (p.injuries.includes('knee')) cautions.push('ひざに不安がある日は、走る代わりにバイク・早歩きで同じ時間を')

  const totalMinutes = blocks.reduce((sum, b) => sum + b.minutes, 0)
  return {
    title: s.type === 'hiit' ? 'インターバルの日' : 'ゆったり有酸素の日',
    subtitle: blocks[blocks.length - 2].items[0].name,
    blocks,
    totalMinutes,
    why,
    cautions,
    next: ['同じメニューが楽に感じてきたら、時間を5分延ばすか、ハードの区間のペースを少し上げる。'],
  }
}
