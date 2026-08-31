import { toISO, type Category } from '../types'
import {
  DAYS,
  EXERCISES,
  EXERCISES_HOME,
  WEEKS,
  type Exercise,
  type GymLocation,
  type PlanDay,
  type SessionKind,
  type WeekPlan,
} from './planData'

const BY_DATE = new Map(DAYS.map(d => [d.date, d]))

/** 12週プランの初日 / 最終日 (レビュー日 11/5 を含む) */
export const FIRST_DATE = DAYS[0].date
export const LAST_DATE = DAYS[DAYS.length - 1].date
/** 進捗バー用。レビュー日を除いたトレーニング日数 */
export const TOTAL_DAYS = DAYS.filter(d => d.kind !== 'review').length

export function planDay(date: string): PlanDay | undefined {
  return BY_DATE.get(date)
}

export function weekPlan(week: number): WeekPlan | undefined {
  return WEEKS.find(w => w.week === week)
}

/** プラン開始からの日数 (初日 = 1) */
export function dayIndex(date: string): number {
  return diffDays(FIRST_DATE, date) + 1
}

// ---- 日付ユーティリティ (すべてローカルタイム基準の YYYY-MM-DD) ----

export function todayISO(): string {
  return toISO(new Date())
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function shiftDate(iso: string, days: number): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() + days)
  return toISO(d)
}

export function diffDays(from: string, to: string): number {
  return Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86400000)
}

/** プラン期間内に丸める。期間外の「今日」でも必ず表示できる日付を返す */
export function clampToPlan(iso: string): string {
  if (iso < FIRST_DATE) return FIRST_DATE
  if (iso > LAST_DATE) return LAST_DATE
  return iso
}

/** 月曜始まりの週。iso を含む 7 日分の日付を返す */
export function weekDates(iso: string): string[] {
  const d = parseISO(iso)
  const mondayOffset = (d.getDay() + 6) % 7
  const monday = shiftDate(iso, -mondayOffset)
  return Array.from({ length: 7 }, (_, i) => shiftDate(monday, i))
}

export function formatMD(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}`
}

const DOW = ['日', '月', '火', '水', '木', '金', '土']

export function dowOf(iso: string): string {
  return DOW[parseISO(iso).getDay()]
}

// ---- セッション種別のメタ情報 ----

export interface SessionMeta {
  /** カード左肩のタグ */
  tag: string
  /** 見出し */
  label: string
  color: string
}

/** 色はスプレッドシートの凡例 (紫=Bodymake / 青=Run/Burpee / 緑=Rest) に合わせている */
export const SESSION_META: Record<SessionKind, SessionMeta> = {
  shoulder: { tag: 'BODYMAKE', label: '肩・三頭・腹', color: '#b18cff' },
  back: { tag: 'BODYMAKE', label: '背中・二頭・腹', color: '#b18cff' },
  optional: { tag: 'BODYMAKE', label: '上半身 (元気な時のみ)', color: '#b18cff' },
  easyrun: { tag: 'RUN', label: 'Easy Run + Burpee', color: '#4dd6ff' },
  quality: { tag: 'RUN', label: 'Quality Run', color: '#4dd6ff' },
  restday: { tag: 'REST', label: '完全レスト', color: '#57e08a' },
  weekend: { tag: 'REST', label: '回復 / 自由', color: '#57e08a' },
  review: { tag: 'REVIEW', label: '12週レビュー', color: '#ffd166' },
}

export const MEAL_COLOR = '#ff9f43'
export const AM_COLOR = '#c6ff3e'

// ---- 補助トレの場所 (Jexer / 家ジム) ----

/** IndexedDBのsettingsに保存するキー */
export const GYM_SETTING = 'accessory-gym'

export const GYM_LABEL: Record<GymLocation, string> = {
  jexer: 'Jexer',
  home: '🏠 家ジム',
}

export function gymLocationOf(v: string | undefined): GymLocation {
  return v === 'home' ? 'home' : 'jexer'
}

/** その日の補助種目を場所に応じて返す。種目が無い日は null */
export function exercisesFor(kind: SessionKind, location: GymLocation): Exercise[] | null {
  if (!(kind in EXERCISES)) return null
  const key = kind as keyof typeof EXERCISES
  return (location === 'home' ? EXERCISES_HOME : EXERCISES)[key]
}

/** 場所で内容が変わる日 (Bodymake日) だけ切り替えUIを出す */
export function locationMatters(kind: SessionKind): boolean {
  if (!(kind in EXERCISES)) return false
  const key = kind as keyof typeof EXERCISES
  return EXERCISES_HOME[key] !== EXERCISES[key]
}

/** '食A/食B' のように複数候補が入るため配列で返す */
export function mealKeys(meal: string): string[] {
  return meal.split('/').map(s => s.trim()).filter(Boolean)
}

/** メモの下書き (プランの内容をそのまま本文に流し込む) */
export function memoDraft(day: PlanDay): {
  category: Category
  title: string
  body: string
  tags: string[]
} {
  const w = day.kind === 'review' ? day.phase : `W${day.week} ${day.phase}`
  const rest = day.kind === 'restday' || day.kind === 'weekend'
  return {
    category: rest ? 'rest' : 'wod',
    title: `${formatMD(day.date)}(${day.dow}) ${w}`,
    body: [`AM: ${day.am}`, `PM: ${day.pm}`, `食事: ${day.meal}`, '', ''].join('\n'),
    tags: [day.phase.replace(/\s+/g, ''), SESSION_META[day.kind].tag.toLowerCase()],
  }
}
