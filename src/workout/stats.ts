import { MUSCLES } from './engine/labels'
import type { HistoryEntry, Muscle } from './engine'

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 月曜始まりの週の初日 */
function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function thisWeekCount(history: HistoryEntry[], now = new Date()): number {
  const start = isoDate(weekStart(now))
  return new Set(history.filter(h => h.date >= start).map(h => h.date)).size
}

/** 週の目標回数を連続で達成している週数 (今週は達成済みなら数える) */
export function weekStreak(history: HistoryEntry[], goal: number, now = new Date()): number {
  const byWeek = new Map<string, Set<string>>()
  for (const h of history) {
    const w = isoDate(weekStart(parse(h.date)))
    if (!byWeek.has(w)) byWeek.set(w, new Set())
    byWeek.get(w)!.add(h.date)
  }
  let streak = 0
  const cursor = weekStart(now)
  const thisWeek = byWeek.get(isoDate(cursor))?.size ?? 0
  if (thisWeek >= goal) streak++
  for (;;) {
    cursor.setDate(cursor.getDate() - 7)
    if ((byWeek.get(isoDate(cursor))?.size ?? 0) >= goal) streak++
    else break
  }
  return streak
}

/** 直近 days 日で、部位ごとに何回鍛えたか */
export function muscleBalance(history: HistoryEntry[], days = 7, now = new Date()): Record<Muscle, number> {
  const since = new Date(now)
  since.setDate(since.getDate() - (days - 1))
  const from = isoDate(since)
  const out = Object.fromEntries(MUSCLES.map(m => [m, 0])) as Record<Muscle, number>
  for (const h of history) if (h.date >= from) h.muscles.forEach(m => out[m]++)
  return out
}

/** 直近 n 日分の日付 (古い順) と、その日にやったかどうか */
export function recentDays(history: HistoryEntry[], n = 28, now = new Date()) {
  const done = new Set(history.map(h => h.date))
  const out: { date: string; done: boolean; dow: number }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    out.push({ date: isoDate(d), done: done.has(isoDate(d)), dow: d.getDay() })
  }
  return out
}
