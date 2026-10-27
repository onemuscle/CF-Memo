// プロフィールから週の型 (何曜日に何をするか) と期間全体の進行 (フェーズ) を組み立てる。
// 同じプロフィールなら必ず同じプランになる (保存するのはプロフィールだけ)。

import { diffDays, dowOf, parseISO, shiftDate } from '../../plan/plan'
import type { Condition, Env, Muscle } from '../../workout/engine'
import { WEEK_ORDER, type Profile } from '../profile'

export type SessionType = 'strength' | 'crossfit' | 'cardio' | 'hiit' | 'rest' | 'review'

export interface Session {
  type: SessionType
  /** 「上半身A」「全身B」「CrossFit」など */
  label: string
  /** 筋トレの日に組む部位 (優先順) */
  focus: Muscle[]
  /** 部位を絞らない全身の日 */
  fullBody: boolean
  env: Env
}

export type PhaseKey = 'intro' | 'build' | 'push' | 'deload' | 'final'

export interface Phase {
  key: PhaseKey
  label: string
  /** 週の狙い (1行) */
  aim: string
  /** 詳しい説明 */
  detail: string
  /** この週のメニュー生成に使う体調の既定値 */
  condition: Condition
  /** 有酸素の長さの倍率 */
  cardioScale: number
  color: string
}

export const PHASES: Record<PhaseKey, Phase> = {
  intro: {
    key: 'intro',
    label: '導入',
    aim: 'フォームを覚えて、体と生活をプランに慣らす週',
    detail:
      'セット数を控えめにし、どの種目も「あと3回はできる」余力を残して終えます。最初の週に追い込みすぎると筋肉痛で2週目が崩れるので、物足りないくらいが正解です。使った重量はメモしておくと次週の基準になります。',
    condition: 'tired',
    cardioScale: 0.6,
    color: 'var(--c-cyan)',
  },
  build: {
    key: 'build',
    label: '積み上げ',
    aim: '回数 → 重量の順に、少しずつ記録を伸ばす週',
    detail:
      'ダブルプログレッションで進めます。決めた回数の上限を全セットでできたら、次回は重量を一段上げて回数の下限からやり直し。毎回ほんの少しでも前回を超えるのが目標です。',
    condition: 'normal',
    cardioScale: 0.8,
    color: 'var(--c-lime)',
  },
  push: {
    key: 'push',
    label: '強化',
    aim: 'ブロックでいちばんきつい週。最終セットは限界近くまで',
    detail:
      '各種目の最後のセットだけは、フォームが崩れない範囲で限界近くまで挑戦します。睡眠と食事をいつも以上に優先し、疲れが抜けない日は無理せず「疲れ気味」に切り替えてください。',
    condition: 'great',
    cardioScale: 1,
    color: 'var(--c-orange)',
  },
  deload: {
    key: 'deload',
    label: 'ディロード',
    aim: '量を落として疲労を抜き、次のブロックで伸びるための週',
    detail:
      '重量はそのままでセット数を減らし、余力を多めに残します。サボりではなく、溜まった疲労を抜いて次の3週間で記録を伸ばすための計画的な休みです。',
    condition: 'tired',
    cardioScale: 0.6,
    color: 'var(--c-green)',
  },
  final: {
    key: 'final',
    label: '仕上げ',
    aim: 'ここまでの成果を確かめる最終週',
    detail:
      'いつもの量でこなしながら、主要な種目の記録・体重・写真を残しておきましょう。最終日のあとは振り返りの日です。次のプランはその結果をもとに作り直せます。',
    condition: 'normal',
    cardioScale: 0.9,
    color: 'var(--c-yellow)',
  },
}

/** week は 1 始まり。4週ごとのブロックで 積み上げ → 積み上げ → 強化 → ディロード を回す */
export function phaseOf(week: number, weeks: number): Phase {
  if (week === 1) return PHASES.intro
  if (week >= weeks) return PHASES.final
  const pos = week % 4
  if (pos === 0) return PHASES.deload
  if (pos === 3) return PHASES.push
  return PHASES.build
}

// ---------------------------------------------------------------- 週の型

const SPLITS = {
  fullA: { label: '全身A', focus: ['legs', 'chest', 'back', 'shoulders', 'core'] },
  fullB: { label: '全身B', focus: ['glutes', 'back', 'chest', 'arms', 'core'] },
  fullC: { label: '全身C', focus: ['legs', 'shoulders', 'back', 'chest', 'core'] },
  upper: { label: '上半身', focus: ['chest', 'back', 'shoulders', 'arms'] },
  lower: { label: '下半身・体幹', focus: ['legs', 'glutes', 'core'] },
  push: { label: '胸・肩・腕', focus: ['chest', 'shoulders', 'arms'] },
  pull: { label: '背中・腕', focus: ['back', 'arms', 'core'] },
  legs: { label: '脚・お尻', focus: ['legs', 'glutes', 'core'] },
  // CrossFit と組み合わせる日は、WODで使いにくい上半身・体幹を補う
  boxUpper: { label: '上半身・体幹', focus: ['shoulders', 'back', 'arms', 'core'] },
  boxShoulder: { label: '肩・腕・腹', focus: ['shoulders', 'arms', 'core'] },
  boxBack: { label: '背中・腕・腹', focus: ['back', 'arms', 'core'] },
} satisfies Record<string, { label: string; focus: Muscle[] }>

type SplitKey = keyof typeof SPLITS

/** 全身を基本にするか (始めたばかり・部位を分けるより回数が大事な目的) */
function prefersFullBody(p: Profile): boolean {
  return p.level === 'beginner' || ['lean', 'health', 'stamina', 'athletic'].includes(p.goal)
}

function strengthSplits(count: number, p: Profile, withBox: boolean): SplitKey[] {
  if (count <= 0) return []
  if (withBox) {
    if (count === 1) return ['boxUpper']
    if (count === 2) return ['boxShoulder', 'boxBack']
  }
  const full = prefersFullBody(p)
  const table: Record<number, SplitKey[]> = {
    1: ['fullA'],
    2: ['fullA', 'fullB'],
    3: full ? ['fullA', 'fullB', 'fullC'] : ['push', 'pull', 'legs'],
    4: ['upper', 'lower', 'upper', 'lower'],
    5: full ? ['upper', 'lower', 'fullA', 'upper', 'lower'] : ['push', 'pull', 'legs', 'upper', 'lower'],
    6: ['push', 'pull', 'legs', 'push', 'pull', 'legs'],
  }
  return table[Math.min(count, 6)]
}

/** n 個の中から k 個をなるべく等間隔に選ぶ (連続させないため) */
function spread(n: number, k: number): Set<number> {
  const out = new Set<number>()
  for (let i = 0; i < k; i++) out.add(Math.min(n - 1, Math.floor(((i + 1) * n) / (k + 1))))
  // 端数で重なったら空いている位置で埋める
  for (let i = n - 1; out.size < k && i >= 0; i--) out.add(i)
  return out
}

/** 筋トレに使う場所 (施設型ジム > 自宅 > 野外) */
export function strengthEnv(p: Profile): Env | undefined {
  return (['gym', 'home', 'outdoor'] as const).find(e => p.places.includes(e))
}

/** 有酸素に使う場所 (野外 > 施設型ジム > 自宅 > CrossFit) */
export function cardioEnv(p: Profile): Env {
  return (['outdoor', 'gym', 'home', 'box'] as const).find(e => p.places.includes(e)) ?? 'home'
}

const REST: Session = { type: 'rest', label: '休養', focus: [], fullBody: false, env: 'home' }

/** 曜日 (0 = 日曜) → その曜日のセッション */
export function weekTemplate(p: Profile): Record<number, Session> {
  const train = WEEK_ORDER.filter(d => p.days.includes(d))
  const n = train.length

  const cardioCount = p.cardio === 'none' || n < 3 ? 0 : p.cardio === 'some' ? 1 : Math.max(1, Math.round(n / 3))
  const sEnv = strengthEnv(p)
  const hasBox = p.places.includes('box')
  const main = n - cardioCount

  let boxCount = 0
  if (hasBox) boxCount = sEnv ? (main >= 2 ? Math.min(main - 1, Math.max(1, Math.round(main * 0.6))) : main) : main
  const strengthCount = main - boxCount

  const cardioAt = spread(n, cardioCount)
  const mainIdx = train.map((_, i) => i).filter(i => !cardioAt.has(i))
  const strengthAt = new Set([...spread(mainIdx.length, strengthCount)].map(i => mainIdx[i]))
  const splits = strengthSplits(strengthCount, p, hasBox)

  // 有酸素の日: 2日以上あれば ゆったり / インターバル を交互に (初心者・健康目的は ゆったり だけ)
  const hiitOk = p.level !== 'beginner' && p.goal !== 'health'
  const cEnv = cardioEnv(p)
  const out: Record<number, Session> = {}
  for (let d = 0; d < 7; d++) out[d] = REST

  let s = 0
  let c = 0
  train.forEach((day, i) => {
    if (cardioAt.has(i)) {
      const hiit = hiitOk && (cardioCount >= 2 ? c % 2 === 1 : ['stamina', 'athletic'].includes(p.goal))
      out[day] = hiit
        ? { type: 'hiit', label: 'HIIT', focus: [], fullBody: false, env: cEnv }
        : { type: 'cardio', label: '有酸素', focus: [], fullBody: false, env: cEnv }
      c++
    } else if (strengthAt.has(i) && sEnv) {
      const split = SPLITS[splits[s % splits.length]]
      out[day] = {
        type: 'strength',
        label: split.label,
        focus: [...split.focus],
        fullBody: split.label.startsWith('全身'),
        env: sEnv,
      }
      s++
    } else {
      out[day] = { type: 'crossfit', label: 'CrossFit', focus: [], fullBody: true, env: 'box' }
    }
  })
  return out
}

// ---------------------------------------------------------------- 期間全体

export interface DayPlan {
  date: string
  dow: string
  /** 1 始まり。振り返りの日は weeks + 1 */
  week: number
  /** 開始日 = 1 */
  index: number
  phase: Phase
  session: Session
}

export interface Plan {
  profile: Profile
  start: string
  /** 最後のトレーニング期間の日 */
  end: string
  /** 期間の翌日 = 振り返りの日 */
  review: string
  totalDays: number
  template: Record<number, Session>
}

export function buildPlan(p: Profile): Plan {
  const totalDays = p.weeks * 7
  return {
    profile: p,
    start: p.startDate,
    end: shiftDate(p.startDate, totalDays - 1),
    review: shiftDate(p.startDate, totalDays),
    totalDays,
    template: weekTemplate(p),
  }
}

const REVIEW: Session = { type: 'review', label: '振り返り', focus: [], fullBody: false, env: 'home' }

/** 期間外 (開始前・振り返りの翌日以降) は undefined */
export function dayPlan(plan: Plan, date: string): DayPlan | undefined {
  const i = diffDays(plan.start, date)
  if (i < 0 || i > plan.totalDays) return undefined
  const weeks = plan.profile.weeks
  if (i === plan.totalDays) {
    return { date, dow: dowOf(date), week: weeks + 1, index: i + 1, phase: PHASES.final, session: REVIEW }
  }
  const week = Math.floor(i / 7) + 1
  const weekday = parseISO(date).getDay()
  return {
    date,
    dow: dowOf(date),
    week,
    index: i + 1,
    phase: phaseOf(week, weeks),
    session: plan.template[weekday],
  }
}

/** 表示する日を期間内に丸める */
export function clampToPlan(plan: Plan, date: string): string {
  if (date < plan.start) return plan.start
  if (date > plan.review) return plan.review
  return date
}

// ---------------------------------------------------------------- 表示用

export interface SessionMeta {
  tag: string
  color: string
}

export const SESSION_META: Record<SessionType, SessionMeta> = {
  strength: { tag: 'STRENGTH', color: 'var(--c-violet)' },
  crossfit: { tag: 'CROSSFIT', color: 'var(--c-lime)' },
  cardio: { tag: 'CARDIO', color: 'var(--c-cyan)' },
  hiit: { tag: 'INTERVAL', color: 'var(--c-pink)' },
  rest: { tag: 'REST', color: 'var(--c-green)' },
  review: { tag: 'REVIEW', color: 'var(--c-yellow)' },
}

/** 「上半身の日」「CrossFit WOD」など、その日の見出し */
export function sessionTitle(s: Session): string {
  switch (s.type) {
    case 'strength':
      return `${s.label}の日`
    case 'crossfit':
      return 'CrossFit の日'
    case 'cardio':
      return 'ゆったり有酸素の日'
    case 'hiit':
      return 'インターバルの日'
    case 'rest':
      return '休養日'
    case 'review':
      return '振り返りの日'
  }
}

export function isTraining(s: Session): boolean {
  return s.type !== 'rest' && s.type !== 'review'
}
