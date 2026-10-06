// 端末内 (localStorage) への保存。サーバーには何も送らない。
// プライベートブラウズ等で使えない場合も画面は動くよう、読み書きはすべて try/catch。

import type { Answers, HistoryEntry, Workout } from './engine'

const KEY = {
  answers: 'kyotore:answers',
  history: 'kyotore:history',
  current: 'kyotore:current',
  oneRm: 'kyotore:onerm',
  weeklyGoal: 'kyotore:weekly-goal',
} as const

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === undefined) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 保存できなくても続行する
  }
}

export const loadAnswers = () => read<Answers | null>(KEY.answers, null)
export const saveAnswers = (a: Answers) => write(KEY.answers, a)

/** 新しい順 */
export const loadHistory = () => read<HistoryEntry[]>(KEY.history, [])
export function addHistory(e: HistoryEntry) {
  write(KEY.history, [e, ...loadHistory().filter(h => h.id !== e.id)].slice(0, 300))
}
export function removeHistory(id: string) {
  write(KEY.history, loadHistory().filter(h => h.id !== id))
}

/** 実施中のメニュー (セットのチェック状況ごと保存して、リロードしても続きから) */
export interface Current {
  workout: Workout
  /** `${blockKey}:${itemIndex}` → 完了したセット数 */
  done: Record<string, number>
  /** タイマーで記録したWODのスコア (blockKey → スコア) */
  scores?: Record<string, string>
  startedAt?: number
}
export const loadCurrent = () => read<Current | null>(KEY.current, null)
export const saveCurrent = (c: Current | null) => write(KEY.current, c ?? undefined)

export const loadOneRm = () => read<Record<string, number>>(KEY.oneRm, {})
export function saveOneRm(lift: string, kg: number | undefined) {
  const all = loadOneRm()
  if (kg && kg > 0) all[lift] = kg
  else delete all[lift]
  write(KEY.oneRm, all)
}

export const loadWeeklyGoal = () => read<number>(KEY.weeklyGoal, 3)
export const saveWeeklyGoal = (n: number) => write(KEY.weeklyGoal, n)
