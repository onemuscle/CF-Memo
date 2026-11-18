/**
 * 分析ロジック (Webアプリ・CLI 共通、外部APIを使わない決定的な計算)
 *
 * 方針:
 * - 推定や予測には必ず「根拠となるデータ数」と「幅 (不確実性)」を付ける
 * - データが足りないときは数字を出さずに insufficient を返す
 * - 健康上の判断を下すものではなく、トレーニング判断の参考指標として扱う
 */

import { keyOf } from './schema.ts'

export type R = Record<string, unknown>
export interface Bundle {
  profile: Record<string, unknown>
  data: Record<string, R[]>
}

// ---------- 日付 ----------

export function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
export function todayISO(): string {
  return toISO(new Date())
}
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return toISO(new Date(y, m - 1, d + n))
}
export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}
/** その日を含む週の月曜日 */
export function weekStart(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return addDays(iso, -((dow + 6) % 7))
}

const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const s = (v: unknown): string => (typeof v === 'string' ? v : '')
const rows = (b: Bundle, name: string): R[] => b.data[name] ?? []
const inRange = (date: string, from: string, to: string) => date >= from && date <= to
export const round = (v: number, digits = 1) => Math.round(v * 10 ** digits) / 10 ** digits

// ---------- 統計 ----------

export interface Trend {
  n: number
  /** 1日あたりの変化量 */
  slope: number
  intercept: number
  /** 残差の標準偏差 */
  se: number
  r2: number
  xMean: number
  sxx: number
  spanDays: number
}

/** 最小二乗の直線 (x = 基準日からの日数) */
export function linearTrend(points: { x: number; y: number }[]): Trend | null {
  const k = points.length
  if (k < 2) return null
  const xMean = points.reduce((a, p) => a + p.x, 0) / k
  const yMean = points.reduce((a, p) => a + p.y, 0) / k
  let sxx = 0
  let sxy = 0
  let syy = 0
  for (const p of points) {
    sxx += (p.x - xMean) ** 2
    sxy += (p.x - xMean) * (p.y - yMean)
    syy += (p.y - yMean) ** 2
  }
  if (sxx === 0) return null
  const slope = sxy / sxx
  const intercept = yMean - slope * xMean
  const sse = points.reduce((a, p) => a + (p.y - (intercept + slope * p.x)) ** 2, 0)
  const se = k > 2 ? Math.sqrt(sse / (k - 2)) : 0
  const xs = points.map(p => p.x)
  return { n: k, slope, intercept, se, r2: syy === 0 ? 1 : 1 - sse / syy, xMean, sxx, spanDays: Math.max(...xs) - Math.min(...xs) }
}

export function pearson(pairs: [number, number][]): number | null {
  const k = pairs.length
  if (k < 3) return null
  const mx = pairs.reduce((a, p) => a + p[0], 0) / k
  const my = pairs.reduce((a, p) => a + p[1], 0) / k
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my)
    sxx += (x - mx) ** 2
    syy += (y - my) ** 2
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null
}

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}
function sd(xs: number[]): number | null {
  const m = mean(xs)
  if (m == null || xs.length < 2) return null
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1))
}

// ---------- 予測 ----------

export interface Projection {
  status: 'ok' | 'insufficient'
  reason?: string
  /** 何日後か */
  horizonDays: number
  date: string
  value?: number
  low?: number
  high?: number
  /** 上限 (capPerYear) で抑えた */
  capped?: boolean
}

export interface ProjectionOptions {
  /**
   * 伸びの頭打ちを表す時定数 (日)。筋力は続けるほど伸びが鈍るので、直線をそのまま延ばさない。
   * 0 なら直線のまま (体重など)。
   */
  saturationDays?: number
  minPoints?: number
  minSpanDays?: number
  /**
   * 1年あたりの変化の上限 (現在値に対する割合)。短期間の急な伸びをそのまま延ばすと
   * 非現実的な値になるため。筋力は経験者で年5〜10%程度が目安。
   */
  capPerYear?: number
}

/**
 * 時系列 (日付と値) から将来の値を推定する。
 * 幅は回帰の予測区間 (約80%) に、先の期間ほど広がる不確実性を足したもの。
 */
export function project(series: { date: string; value: number }[], horizons: number[], from: string, opts: ProjectionOptions = {}): Projection[] {
  const minPoints = opts.minPoints ?? 4
  const minSpan = opts.minSpanDays ?? 21
  const base = series.length ? series[0].date : from
  const pts = series.map(p => ({ x: daysBetween(base, p.date), y: p.value }))
  const t = linearTrend(pts)
  return horizons.map(h => {
    const date = addDays(from, h)
    if (!t || t.n < minPoints || t.spanDays < minSpan) {
      return {
        status: 'insufficient' as const,
        reason: `記録が${series.length}件・${t?.spanDays ?? 0}日分です (${minPoints}件以上・${minSpan}日以上必要)`,
        horizonDays: h,
        date,
      }
    }
    const x0 = daysBetween(base, from)
    const now = t.intercept + t.slope * x0
    const tau = opts.saturationDays ?? 0
    const effective = tau > 0 ? tau * (1 - Math.exp(-h / tau)) : h
    let gain = t.slope * effective
    let capped = false
    if (opts.capPerYear != null && now > 0) {
      const cap = now * opts.capPerYear * (h / 365)
      if (Math.abs(gain) > cap) {
        gain = Math.sign(gain) * cap
        capped = true
      }
    }
    const value = now + gain
    const x = x0 + effective
    const z = 1.28 // 約80%
    const fitErr = t.se * Math.sqrt(1 + 1 / t.n + (x - t.xMean) ** 2 / t.sxx)
    // データ期間の外側へ延ばすほど不確実性を足す (外挿の割増し)
    const extrap = Math.abs(gain) * 0.5
    const width = z * fitErr + extrap
    return { status: 'ok' as const, horizonDays: h, date, value: round(value), low: round(value - width), high: round(value + width), capped }
  })
}

// ---------- 筋力 ----------

export interface LiftSummary {
  key: string
  movement: string
  bestE1rm: number | null
  bestE1rmDate: string | null
  /** 実際に挙げた最高重量 (回数問わず) */
  heaviest: { weight: number; reps: number; date: string } | null
  /** 回数ごとの最高重量 (1RM, 3RM, 5RM ...) */
  repMaxes: Record<number, { weight: number; date: string }>
  /** 日ごとの最高推定1RM */
  daily: { date: string; value: number }[]
  lastDate: string
  setCount: number
}

export function liftSummaries(sets: R[]): LiftSummary[] {
  const by = new Map<string, LiftSummary>()
  const sorted = [...sets].sort((a, b) => s(a.date).localeCompare(s(b.date)))
  for (const r of sorted) {
    const key = s(r.movement_key) || keyOf(s(r.movement))
    if (!key) continue
    let L = by.get(key)
    if (!L) {
      L = { key, movement: s(r.movement), bestE1rm: null, bestE1rmDate: null, heaviest: null, repMaxes: {}, daily: [], lastDate: s(r.date), setCount: 0 }
      by.set(key, L)
    }
    L.movement = s(r.movement) || L.movement
    L.lastDate = s(r.date)
    L.setCount += n(r.sets) ?? 1
    const w = n(r.weight_kg)
    const reps = n(r.reps)
    const e = n(r.e1rm_kg)
    if (w != null && reps != null && reps > 0) {
      if (!L.heaviest || w > L.heaviest.weight) L.heaviest = { weight: w, reps, date: s(r.date) }
      const rm = L.repMaxes[reps]
      if (!rm || w > rm.weight) L.repMaxes[reps] = { weight: w, date: s(r.date) }
    }
    if (e != null) {
      if (L.bestE1rm == null || e > L.bestE1rm) {
        L.bestE1rm = e
        L.bestE1rmDate = s(r.date)
      }
      const last = L.daily[L.daily.length - 1]
      if (last && last.date === r.date) last.value = Math.max(last.value, e)
      else L.daily.push({ date: s(r.date), value: e })
    }
  }
  return [...by.values()].sort((a, b) => b.lastDate.localeCompare(a.lastDate))
}

export interface PrEvent {
  date: string
  movement: string
  kind: 'e1rm' | 'rep_max'
  reps?: number
  value: number
  previous: number | null
}

/** 自己ベスト更新の履歴 (期間内に起きたもの) */
export function prEvents(sets: R[], from: string, to: string): PrEvent[] {
  const out: PrEvent[] = []
  const bestE = new Map<string, number>()
  const bestRm = new Map<string, number>()
  const sorted = [...sets].sort((a, b) => s(a.date).localeCompare(s(b.date)) || s(a.created_at).localeCompare(s(b.created_at)))
  for (const r of sorted) {
    const key = s(r.movement_key) || keyOf(s(r.movement))
    const date = s(r.date)
    const e = n(r.e1rm_kg)
    const w = n(r.weight_kg)
    const reps = n(r.reps)
    if (e != null) {
      const prev = bestE.get(key) ?? null
      if (prev == null || e > prev) {
        if (prev != null && inRange(date, from, to)) out.push({ date, movement: s(r.movement), kind: 'e1rm', value: e, previous: prev })
        bestE.set(key, e)
      }
    }
    if (w != null && reps != null && reps >= 1 && reps <= 10) {
      const k2 = `${key}#${reps}`
      const prev = bestRm.get(k2) ?? null
      if (prev == null || w > prev) {
        if (prev != null && inRange(date, from, to)) out.push({ date, movement: s(r.movement), kind: 'rep_max', reps, value: w, previous: prev })
        bestRm.set(k2, w)
      }
    }
  }
  return out
}

// ---------- 体組成 ----------

/** 日ごとの値 (同じ日に複数あれば平均) */
export function dailyValues(list: R[], field: string, dateField = 'date'): { date: string; value: number }[] {
  const m = new Map<string, number[]>()
  for (const r of list) {
    const v = n(r[field])
    if (v == null) continue
    const d = s(r[dateField])
    m.set(d, [...(m.get(d) ?? []), v])
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, vs]) => ({ date, value: mean(vs)! }))
}

/** 移動平均 (過去 window 日に入る記録の平均) */
export function movingAverage(series: { date: string; value: number }[], window = 7): { date: string; value: number }[] {
  return series.map(p => {
    const from = addDays(p.date, -(window - 1))
    const vs = series.filter(q => q.date >= from && q.date <= p.date).map(q => q.value)
    return { date: p.date, value: round(mean(vs)!, 2) }
  })
}

/** 直近 days 日の変化ペース (1週間あたり) */
export function weeklyRate(series: { date: string; value: number }[], asOf: string, days = 28): { perWeek: number; n: number } | null {
  const from = addDays(asOf, -days)
  const pts = series.filter(p => p.date >= from && p.date <= asOf)
  const t = linearTrend(pts.map(p => ({ x: daysBetween(from, p.date), y: p.value })))
  if (!t || t.n < 4 || t.spanDays < 10) return null
  return { perWeek: round(t.slope * 7, 2), n: t.n }
}

// ---------- Apple Watch と手入力の重複 ----------

/**
 * Apple Watch (source=health) のワークアウトは、同じ日に手入力の記録があれば集計から外す。
 * 例: 朝の WOD を手入力し、Apple Watch も同じ WOD を記録した → 手入力の1件として数える。
 * 行そのものは消さない (心拍などは Apple Watch 側の行で見られる)。
 */
export function dedupeHealth(b: Bundle): Bundle {
  const w = rows(b, 'workouts')
  const c = rows(b, 'cardio_sessions')
  const manualW = new Set(w.filter(r => r.source !== 'health').map(r => s(r.date)))
  const manualC = new Set(c.filter(r => r.source !== 'health').map(r => `${s(r.date)}|${s(r.modality)}`))
  return {
    ...b,
    data: {
      ...b.data,
      workouts: w.filter(r => r.source !== 'health' || !manualW.has(s(r.date))),
      cardio_sessions: c.filter(r => r.source !== 'health' || !manualC.has(`${s(r.date)}|${s(r.modality)}`)),
    },
  }
}

// ---------- トレーニング負荷・回復 ----------

/** 1日ごとの負荷 (セッションRPE × 分)。有酸素は RPE が無ければ内容から推定 */
export function dailyLoad(input: Bundle): Map<string, number> {
  const b = dedupeHealth(input)
  const m = new Map<string, number>()
  const add = (d: string, v: number) => m.set(d, (m.get(d) ?? 0) + v)
  const linkedCardio = new Set<string>()
  for (const w of rows(b, 'workouts')) {
    const load = n(w.session_load)
    if (load != null) add(s(w.date), load)
    else {
      const dur = n(w.duration_min)
      if (dur != null) add(s(w.date), dur * 6) // RPE 不明は 6 とみなす
    }
  }
  for (const c of rows(b, 'cardio_sessions')) {
    if (c.workout_id) {
      linkedCardio.add(s(c.workout_id))
      continue // 親のセッションで計上済み
    }
    const min = (n(c.duration_s) ?? 0) / 60
    if (!min) continue
    const rpe = n(c.rpe) ?? ({ easy: 3, long: 5, tempo: 7, interval: 8, race: 9, test: 9 } as Record<string, number>)[s(c.kind)] ?? 5
    add(s(c.date), Math.round(min * rpe))
  }
  return m
}

export interface LoadStatus {
  acute7: number
  chronic28: number
  /** 急性:慢性 負荷比。1.5 を超えると怪我のリスクが上がるとされる参考指標 */
  acwr: number | null
  monotony: number | null
  strain: number | null
  daysWithData: number
  zone: 'unknown' | 'low' | 'optimal' | 'high' | 'very_high'
}

export function loadStatus(b: Bundle, asOf: string): LoadStatus {
  const m = dailyLoad(b)
  const day = (k: number) => m.get(addDays(asOf, -k)) ?? 0
  let acute = 0
  let chronic = 0
  const last7: number[] = []
  let daysWithData = 0
  for (let k = 0; k < 28; k++) {
    const v = day(k)
    if (k < 7) {
      acute += v
      last7.push(v)
    }
    chronic += v
    if (m.has(addDays(asOf, -k))) daysWithData++
  }
  const chronicWeekly = chronic / 4
  const acwr = chronicWeekly > 0 && daysWithData >= 8 ? round(acute / chronicWeekly, 2) : null
  const sdv = sd(last7)
  const monotony = sdv && sdv > 0 ? round(mean(last7)! / sdv, 2) : null
  const zone: LoadStatus['zone'] = acwr == null ? 'unknown' : acwr < 0.8 ? 'low' : acwr <= 1.3 ? 'optimal' : acwr <= 1.5 ? 'high' : 'very_high'
  return { acute7: Math.round(acute), chronic28: Math.round(chronicWeekly), acwr, monotony, strain: monotony ? Math.round(acute * monotony) : null, daysWithData, zone }
}

export interface Readiness {
  /** 0-100。データが無い項目は計算に入れない */
  score: number | null
  level: 'push' | 'normal' | 'easy' | 'rest' | 'unknown'
  components: { label: string; value: string; score: number; note?: string }[]
  advice: string[]
}

/**
 * その日のコンディションの目安。睡眠・主観 (疲労/筋肉痛/ストレス)・負荷比・HRV/安静時心拍 を合成する。
 * 医学的な判断ではなく「今日どれくらい攻めるか」の参考。
 */
export function readiness(b: Bundle, date: string, sleepTargetMin = 420): Readiness {
  const comps: Readiness['components'] = []
  const advice: string[] = []
  const sleep = rows(b, 'sleep_logs').filter(r => r.date === date)
  const sleepMin = mean(sleep.map(r => n(r.duration_min)).filter((v): v is number => v != null))
  if (sleepMin != null) {
    const sc = Math.max(0, Math.min(100, 100 - Math.max(0, sleepTargetMin - sleepMin) * 0.5))
    comps.push({ label: '睡眠', value: `${Math.floor(sleepMin / 60)}時間${Math.round(sleepMin % 60)}分`, score: sc })
    if (sleepMin < 360) advice.push('睡眠が6時間未満。高強度・高ボリュームは控えめに、技術練習や有酸素中心が無難です')
  }
  const w = rows(b, 'wellness').find(r => r.date === date)
  if (w) {
    const items: [string, string, boolean][] = [
      ['fatigue', '疲労', true],
      ['soreness', '筋肉痛', true],
      ['stress', 'ストレス', true],
      ['motivation', 'やる気', false],
    ]
    for (const [f, label, inverse] of items) {
      const v = n(w[f])
      if (v == null) continue
      const sc = inverse ? (5 - v) * 25 : (v - 1) * 25
      comps.push({ label, value: `${v}/5`, score: sc })
    }
    if (w.sick) {
      comps.push({ label: '体調不良', value: 'あり', score: 0 })
      advice.push('体調不良の申告あり。休養を優先してください')
    }
    if ((n(w.soreness) ?? 0) >= 4 && s(w.sore_areas)) advice.push(`${s(w.sore_areas)} に強い張り。その部位の高負荷は避けて別部位・有酸素へ`)
  }
  const ls = loadStatus(b, date)
  if (ls.acwr != null) {
    const sc = ls.acwr <= 1.3 && ls.acwr >= 0.8 ? 100 : ls.acwr <= 1.5 ? 60 : ls.acwr > 1.5 ? 20 : 80
    comps.push({ label: '負荷比 (直近7日/28日)', value: String(ls.acwr), score: sc })
    if (ls.acwr > 1.5) advice.push(`直近1週間の負荷が普段の${ls.acwr}倍。ここ数日は量を落とす日を入れてください`)
  }
  const hrvBase = baseline(b, 'hrv_ms', date)
  if (hrvBase) {
    const ratio = hrvBase.today / hrvBase.base
    const sc = Math.max(0, Math.min(100, 50 + (ratio - 1) * 250))
    comps.push({ label: 'HRV (28日平均比)', value: `${Math.round(hrvBase.today)}ms (${ratio >= 1 ? '+' : ''}${Math.round((ratio - 1) * 100)}%)`, score: sc })
    if (ratio < 0.85) advice.push('HRVが普段より15%以上低い。疲労が抜けていない可能性')
  }
  const rhrBase = baseline(b, 'resting_hr', date)
  if (rhrBase) {
    const diff = rhrBase.today - rhrBase.base
    const sc = Math.max(0, Math.min(100, 80 - diff * 10))
    comps.push({ label: '安静時心拍 (28日平均比)', value: `${Math.round(rhrBase.today)}bpm (${diff >= 0 ? '+' : ''}${round(diff)})`, score: sc })
    if (diff >= 5) advice.push('安静時心拍が普段より5拍以上高い。体調・睡眠を確認してください')
  }
  const active = rows(b, 'injuries').filter(r => r.status === 'active' || r.status === 'recovering')
  for (const i of active) advice.push(`${s(i.body_part)}: ${i.status === 'active' ? '痛みあり' : '回復中'}${i.avoid ? ` — 避ける動き: ${s(i.avoid)}` : ''}`)

  if (!comps.length) return { score: null, level: 'unknown', components: [], advice: ['今日の睡眠かコンディションを記録すると、目安が出ます', ...advice] }
  const score = Math.round(comps.reduce((a, c) => a + c.score, 0) / comps.length)
  let level: Readiness['level'] = w?.sick ? 'rest' : score >= 75 ? 'push' : score >= 55 ? 'normal' : score >= 35 ? 'easy' : 'rest'
  // 一つでも強い警告があれば、平均点が高くても「攻めてOK」にはしない
  const order = ['rest', 'easy', 'normal', 'push'] as const
  const cap = (max: (typeof order)[number]) => {
    if (order.indexOf(level as (typeof order)[number]) > order.indexOf(max)) level = max
  }
  if (sleepMin != null && sleepMin < 360) cap('easy')
  if (ls.acwr != null && ls.acwr > 1.5) cap('easy')
  if (hrvBase && hrvBase.today / hrvBase.base < 0.85) cap('normal')
  if (rhrBase && rhrBase.today - rhrBase.base >= 5) cap('normal')
  if ((n(w?.soreness) ?? 0) >= 4) cap('normal')
  if (active.some(i => i.status === 'active')) cap('normal')
  return { score, level, components: comps, advice }
}

/** sleep_logs と daily_health を合わせて、その日の値と過去28日の平均 */
function baseline(b: Bundle, field: string, date: string): { today: number; base: number } | null {
  const all = [...rows(b, 'sleep_logs'), ...rows(b, 'daily_health')]
  const today = mean(all.filter(r => r.date === date).map(r => n(r[field])).filter((v): v is number => v != null))
  if (today == null) return null
  const from = addDays(date, -28)
  const past = all.filter(r => s(r.date) >= from && s(r.date) < date).map(r => n(r[field])).filter((v): v is number => v != null)
  if (past.length < 7) return null
  return { today, base: mean(past)! }
}

// ---------- 栄養 ----------

export interface DayNutrition {
  date: string
  kcal: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
  entries: number
}

/** 1日ごとの合計。「1日合計」の行がある日はそちらを優先 */
export function nutritionByDay(list: R[]): DayNutrition[] {
  const by = new Map<string, R[]>()
  for (const r of list) by.set(s(r.date), [...(by.get(s(r.date)) ?? []), r])
  const out: DayNutrition[] = []
  for (const [date, rs] of by) {
    const total = rs.find(r => r.meal === 'day_total')
    const src = total ? [total] : rs
    const sum = (f: string) => {
      const vs = src.map(r => n(r[f])).filter((v): v is number => v != null)
      return vs.length ? round(vs.reduce((a, b) => a + b, 0)) : null
    }
    out.push({ date, kcal: sum('kcal'), protein_g: sum('protein_g'), fat_g: sum('fat_g'), carbs_g: sum('carbs_g'), entries: rs.length })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/** その日に有効な栄養目標 (適用開始日が一番新しいもの) */
export function targetFor(targets: R[], date: string, dayType?: string): R | null {
  const valid = targets
    .filter(t => s(t.start_date) <= date)
    .filter(t => !dayType || !t.day_type || t.day_type === dayType)
    .sort((a, b) => s(b.start_date).localeCompare(s(a.start_date)))
  return valid[0] ?? null
}

// ---------- 持久力 ----------

export function paceLabel(secPerKm: number | null | undefined): string {
  if (!secPerKm) return '—'
  const m = Math.floor(secPerKm / 60)
  const sec = Math.round(secPerKm % 60)
  return `${m}'${String(sec).padStart(2, '0')}"/km`
}

export function durationLabel(sec: number | null | undefined): string {
  if (sec == null) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const ss = Math.round(sec % 60)
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`
}

/**
 * Riegel の式で別距離のタイムを推定 (T2 = T1 × (D2/D1)^1.06)。
 * 持久系トレーニングを積んでいる人の目安で、筋量の多い CrossFit 選手は長距離ほど遅めに出やすい。
 */
export function riegel(sec: number, fromM: number, toM: number, exponent = 1.06): number {
  return sec * (toM / fromM) ** exponent
}

/** Zone2 などイージー走の「同じ心拍でどれだけ速く走れるか」(効率) の推移 */
export function aerobicEfficiency(cardio: R[]): { date: string; value: number }[] {
  return cardio
    .filter(c => c.modality === 'run' && (c.kind === 'easy' || c.kind === 'long') && n(c.avg_hr) && n(c.pace_s_per_km))
    .map(c => ({
      date: s(c.date),
      // 1拍あたりの速度 (m/分 ÷ bpm × 100)。大きいほど効率が良い
      value: round(((1000 / n(c.pace_s_per_km)!) * 60 / n(c.avg_hr)!) * 100, 2),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// ---------- 目標 ----------

export interface GoalProgress {
  current: number | null
  currentLabel: string
  pct: number | null
  projectedDate: string | null
  onTrack: boolean | null
  basis: string
}

/** 目標の指標名 (metric) から現在値を求める */
export function metricSeries(b: Bundle, metric: string): { series: { date: string; value: number }[]; label: string; saturation: number } | null {
  const [kind, ...rest] = metric.split(':')
  const arg = keyOf(rest.join(':'))
  switch (kind.trim()) {
    case 'e1rm': {
      const L = liftSummaries(rows(b, 'strength_sets')).find(l => l.key === arg)
      return L ? { series: runningMax(L.daily), label: `${L.movement} 推定1RM`, saturation: 180 } : { series: [], label: '推定1RM', saturation: 180 }
    }
    case 'weight':
      return { series: movingAverage(dailyValues(rows(b, 'body_metrics'), 'weight_kg')), label: '体重 (7日平均)', saturation: 0 }
    case 'body_fat':
      return { series: movingAverage(dailyValues(rows(b, 'body_metrics'), 'body_fat_pct')), label: '体脂肪率 (7日平均)', saturation: 0 }
    case 'muscle':
      return { series: movingAverage(dailyValues(rows(b, 'body_metrics'), 'muscle_kg')), label: '筋肉量 (7日平均)', saturation: 0 }
    case 'waist':
      return { series: dailyValues(rows(b, 'body_metrics'), 'waist_cm'), label: '腹囲', saturation: 0 }
    case 'skill': {
      const logs = rows(b, 'skill_logs').filter(r => s(r.skill_key) === arg)
      return { series: runningMax(dailyValues(logs, 'max_unbroken')), label: '最大連続回数', saturation: 120 }
    }
    case 'sleep':
      return { series: movingAverage(dailyValues(rows(b, 'sleep_logs'), 'duration_min')).map(p => ({ ...p, value: round(p.value / 60, 2) })), label: '睡眠 (7日平均・時間)', saturation: 0 }
    case 'protein':
      return { series: movingAverage(nutritionByDay(rows(b, 'nutrition_entries')).filter(d => d.protein_g != null).map(d => ({ date: d.date, value: d.protein_g! }))), label: 'たんぱく質 (7日平均)', saturation: 0 }
    case 'run': {
      // run:5000 → 5km 以上を走った記録の5km換算タイム (秒)。小さいほど良い
      const dist = Number(rest[0])
      if (!dist) return null
      const list = rows(b, 'cardio_sessions')
        .filter(c => c.modality === 'run' && (n(c.distance_m) ?? 0) >= dist * 0.8 && n(c.duration_s) && ['tempo', 'race', 'test', 'interval'].includes(s(c.kind)))
        .map(c => ({ date: s(c.date), value: Math.round(riegel(n(c.duration_s)!, n(c.distance_m)!, dist)) }))
      return { series: runningMin(dailyValues(list.map(x => ({ date: x.date, v: x.value })), 'v')), label: `${dist / 1000}km 換算タイム (秒)`, saturation: 180 }
    }
    default:
      return null
  }
}

function runningMax(series: { date: string; value: number }[]) {
  let best = -Infinity
  return series.map(p => ({ date: p.date, value: (best = Math.max(best, p.value)) }))
}
function runningMin(series: { date: string; value: number }[]) {
  let best = Infinity
  return series.map(p => ({ date: p.date, value: (best = Math.min(best, p.value)) }))
}

export function goalProgress(b: Bundle, goal: R, asOf: string): GoalProgress {
  const metric = s(goal.metric)
  const target = n(goal.target_value)
  const ms = metric ? metricSeries(b, metric) : null
  if (!ms || !ms.series.length) {
    return { current: null, currentLabel: '—', pct: null, projectedDate: null, onTrack: null, basis: metric ? 'まだ該当する記録がありません' : '指標 (metric) が未設定です' }
  }
  const current = ms.series[ms.series.length - 1].value
  const start = n(goal.start_value) ?? ms.series[0].value
  const down = goal.direction === 'down' || (target != null && target < start)
  let pct: number | null = null
  if (target != null && target !== start) pct = Math.max(0, Math.min(100, Math.round(((current - start) / (target - start)) * 100)))
  let projectedDate: string | null = null
  let onTrack: boolean | null = null
  const recent = ms.series.filter(p => p.date >= addDays(asOf, -120))
  const t = linearTrend(recent.map(p => ({ x: daysBetween(asOf, p.date), y: p.value })))
  if (target != null && t && t.n >= 4 && t.spanDays >= 21) {
    const now = t.intercept
    const need = target - now
    if ((need > 0 && t.slope > 0) || (need < 0 && t.slope < 0)) {
      const days = Math.round(need / t.slope)
      if (days < 3650) projectedDate = addDays(asOf, days)
    }
    if ((down && current <= target) || (!down && current >= target)) projectedDate = asOf
    if (goal.target_date && projectedDate) onTrack = projectedDate <= s(goal.target_date)
    else if (goal.target_date) onTrack = false
  }
  return {
    current: round(current, 2),
    currentLabel: `${round(current, 1)}${goal.unit ? s(goal.unit) : ''}`,
    pct,
    projectedDate,
    onTrack,
    basis: `${ms.label}・直近120日の${t?.n ?? 0}件から推定`,
  }
}

// ---------- 期間サマリー (週次・月次レポート) ----------

export interface PeriodSummary {
  from: string
  to: string
  days: number
  sessions: number
  sessionsByType: Record<string, number>
  trainingMin: number
  load: number
  cardioKm: Record<string, number>
  prs: PrEvent[]
  avgSleepMin: number | null
  sleepNights: number
  avgWeight: number | null
  weightChange: number | null
  avgKcal: number | null
  avgProtein: number | null
  nutritionDays: number
  avgFatigue: number | null
  skillUpdates: { skill: string; level: string; maxUnbroken: number | null; date: string }[]
  activeInjuries: string[]
}

export function periodSummary(input: Bundle, from: string, to: string): PeriodSummary {
  const b = dedupeHealth(input)
  const within = (name: string, field = 'date') => rows(b, name).filter(r => inRange(s(r[field]), from, to))
  const ws = within('workouts')
  const byType: Record<string, number> = {}
  for (const w of ws) byType[s(w.type)] = (byType[s(w.type)] ?? 0) + 1
  const cardio = within('cardio_sessions')
  const km: Record<string, number> = {}
  for (const c of cardio) {
    const d = n(c.distance_m)
    if (d) km[s(c.modality)] = round((km[s(c.modality)] ?? 0) + d / 1000, 1)
  }
  const load = [...dailyLoad(b).entries()].filter(([d]) => inRange(d, from, to)).reduce((a, [, v]) => a + v, 0)
  const sleep = dailyValues(within('sleep_logs'), 'duration_min')
  const weight = dailyValues(within('body_metrics'), 'weight_kg')
  const nut = nutritionByDay(within('nutrition_entries'))
  const fatigue = within('wellness').map(r => n(r.fatigue)).filter((v): v is number => v != null)
  const cardioMin = cardio.filter(c => !c.workout_id).reduce((a, c) => a + (n(c.duration_s) ?? 0) / 60, 0)
  return {
    from,
    to,
    days: daysBetween(from, to) + 1,
    sessions: ws.length + cardio.filter(c => !c.workout_id).length,
    sessionsByType: byType,
    trainingMin: Math.round(ws.reduce((a, w) => a + (n(w.duration_min) ?? 0), 0) + cardioMin),
    load: Math.round(load),
    cardioKm: km,
    prs: prEvents(rows(b, 'strength_sets'), from, to),
    avgSleepMin: sleep.length ? Math.round(mean(sleep.map(p => p.value))!) : null,
    sleepNights: sleep.length,
    avgWeight: weight.length ? round(mean(weight.map(p => p.value))!, 1) : null,
    weightChange: weight.length >= 2 ? round(weight[weight.length - 1].value - weight[0].value, 1) : null,
    avgKcal: nut.length ? Math.round(mean(nut.map(d => d.kcal).filter((v): v is number => v != null)) ?? 0) || null : null,
    avgProtein: nut.length ? Math.round(mean(nut.map(d => d.protein_g).filter((v): v is number => v != null)) ?? 0) || null : null,
    nutritionDays: nut.length,
    avgFatigue: fatigue.length ? round(mean(fatigue)!, 1) : null,
    skillUpdates: within('skill_logs').map(r => ({ skill: s(r.skill), level: s(r.level), maxUnbroken: n(r.max_unbroken), date: s(r.date) })),
    activeInjuries: rows(b, 'injuries').filter(r => r.status === 'active' || r.status === 'recovering').map(r => s(r.body_part)),
  }
}

// ---------- 関係性の分析 ----------

export interface Relation {
  label: string
  r: number | null
  n: number
  note: string
}

/**
 * 睡眠・栄養・負荷とコンディションの関係 (相関)。
 * 相関は因果ではなく、n が小さいうちは偶然でも大きく出る。n < 14 は「参考外」と表示する。
 */
export function relations(b: Bundle): Relation[] {
  const sleepBy = new Map(dailyValues(rows(b, 'sleep_logs'), 'duration_min').map(p => [p.date, p.value]))
  const wellness = rows(b, 'wellness')
  const load = dailyLoad(b)
  const nut = new Map(nutritionByDay(rows(b, 'nutrition_entries')).map(d => [d.date, d]))
  const pairs = (fn: (date: string) => [number | null | undefined, number | null | undefined]) => {
    const out: [number, number][] = []
    const dates = new Set([...sleepBy.keys(), ...wellness.map(w => s(w.date)), ...load.keys(), ...nut.keys()])
    for (const d of dates) {
      const [x, y] = fn(d)
      if (x != null && y != null) out.push([x, y])
    }
    return out
  }
  const wBy = new Map(wellness.map(w => [s(w.date), w]))
  const defs: [string, [number, number][], string][] = [
    ['睡眠時間 → 当日の疲労感', pairs(d => [sleepBy.get(d), n(wBy.get(d)?.fatigue)]), '負の相関なら「よく寝た日は疲労感が低い」'],
    ['前日の負荷 → 翌日の筋肉痛', pairs(d => [load.get(addDays(d, -1)) ?? (wBy.has(d) ? 0 : null), n(wBy.get(d)?.soreness)]), '正の相関なら「きつい日の翌日は張る」'],
    ['前日のたんぱく質 → 翌日の筋肉痛', pairs(d => [nut.get(addDays(d, -1))?.protein_g, n(wBy.get(d)?.soreness)]), ''],
    ['前日の負荷 → 当夜の睡眠', pairs(d => [load.get(addDays(d, -1)) ?? null, sleepBy.get(d)]), ''],
  ]
  return defs.map(([label, ps, note]) => {
    const r = pearson(ps)
    return { label, r: r == null ? null : round(r, 2), n: ps.length, note: ps.length < 14 ? `データ${ps.length}日分 — 14日分たまるまで参考外` : note }
  })
}
