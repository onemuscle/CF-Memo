import type { HistoryEntry, Level, Muscle, Rating } from './types'

export const WARMUP_SEC = 240
export const COOLDOWN_SEC = 120
/** ウォームアップ + クールダウンのストレッチ (合計6分) */
export const BOOKEND_MIN = (WARMUP_SEC + COOLDOWN_SEC) / 60

export const LEVEL_NUM: Record<Level, 1 | 2 | 3> = { beginner: 1, intermediate: 2, advanced: 3 }

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/** 秒を「90秒」「2分」「2分30秒」に */
export function secText(sec: number): string {
  if (sec < 60) return `${sec}秒`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s ? `${m}分${s}秒` : `${m}分`
}

/** 休憩秒数を15秒単位に丸める */
export function roundRest(sec: number): number {
  return Math.max(15, Math.round(sec / 15) * 15)
}

export function todayKey(now: Date): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function daysBetween(fromISO: string, now: Date): number {
  const [y, m, d] = fromISO.split('-').map(Number)
  const from = new Date(y, m - 1, d)
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((to.getTime() - from.getTime()) / 86400000)
}

/**
 * 履歴のうちメニュー生成に使う情報だけを抜き出したもの。
 * 共有URLにも載せるので、相手の端末でも同じメニューを再現できる。
 */
export interface GenContext {
  /** 前回の「きつさ」 */
  rating?: Rating
  /** 部位ごとに、最後に鍛えてから何日か (9日以上・記録なしは省略) */
  ago: Partial<Record<Muscle, number>>
  /** 直近7日にやった種目ID → 何日前か */
  used: Record<string, number>
}

export const EMPTY_CONTEXT: GenContext = { ago: {}, used: {} }

export function contextOf(history: HistoryEntry[], now: Date): GenContext {
  // 前回の評価は1週間以内のものだけ使う
  const recentRating = history[0] && daysBetween(history[0].date, now) <= 7 ? history[0].rating : undefined
  const ctx: GenContext = { rating: recentRating, ago: {}, used: {} }
  for (const h of history) {
    const ago = daysBetween(h.date, now)
    if (ago < 0 || ago > 8) continue
    for (const m of h.muscles) if (ctx.ago[m] === undefined || ago < ctx.ago[m]!) ctx.ago[m] = ago
    if (ago <= 7) for (const id of h.exerciseIds) if (ctx.used[id] === undefined || ago < ctx.used[id]) ctx.used[id] = ago
  }
  return ctx
}

/** 「昨日」「3日前」 */
export function agoText(days: number): string {
  if (days <= 0) return '今日'
  if (days === 1) return '昨日'
  if (days === 2) return 'おととい'
  return `${days}日前`
}

/** WODの回数を区切りの良い数に丸める */
export function niceReps(n: number, unit: 'reps' | 'cal' | 'm'): number {
  if (unit === 'm') return Math.max(100, Math.round(n / 100) * 100)
  if (n <= 15) return Math.max(1, Math.round(n))
  return Math.round(n / 5) * 5
}
