/**
 * Apple ヘルスケア (Apple Watch・体重計など) から送られてくるデータを、記録の形に変換する。
 *
 * 受け付ける形式は2つ:
 *  1. かんたん形式 (iPhone の「ショートカット」から送る想定)
 *     { "date": "2026-11-18", "sleep_min": 412, "hrv_ms": 58, "resting_hr": 52, "steps": 8200,
 *       "active_kcal": 640, "exercise_min": 75, "vo2max": 48.1, "weight_kg": 86.4, "body_fat_pct": 14.2 }
 *     配列で複数日まとめても良い。
 *  2. Health Auto Export (iOS アプリ) の REST API 書き出し形式
 *     { "data": { "metrics": [{ "name": "step_count", "units": "count", "data": [{ "date": "...", "qty": 1 }] }],
 *                 "workouts": [{ "name": "Running", "start": "...", "end": "...", ... }] } }
 *
 * 出力の id は日付やワークアウト開始時刻から決まるので、同じデータを何度送っても二重登録にならない。
 * 知らない項目は無視する (アプリ側の仕様変更で取り込みが止まらないように)。
 */

export interface HealthRows {
  daily_health: Record<string, unknown>[]
  sleep_logs: Record<string, unknown>[]
  body_metrics: Record<string, unknown>[]
  cardio_sessions: Record<string, unknown>[]
  workouts: Record<string, unknown>[]
}

export interface ParsedHealth {
  rows: HealthRows
  /** 読み取れなかった・無視した項目 (応答で返して、設定ミスに気づけるようにする) */
  ignored: string[]
  format: 'simple' | 'health_auto_export'
}

const DATE_RE = /^(\d{4}-\d{2}-\d{2})/

/** 数値か {qty: 数値} を数値にする */
function q(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  if (v && typeof v === 'object' && 'qty' in v) return q((v as { qty: unknown }).qty)
  return null
}

function dateOf(v: unknown): string | null {
  const m = typeof v === 'string' ? v.match(DATE_RE) : null
  return m ? m[1] : null
}

/** "2026-11-18 06:12:00 +0900" → "06:12" (送信元の端末の時刻のまま) */
function timeOf(v: unknown): string | null {
  const m = typeof v === 'string' ? v.match(/[ T](\d{2}):(\d{2})/) : null
  return m ? `${m[1]}:${m[2]}` : null
}

const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d

function unitScale(units: unknown, kind: 'energy' | 'mass' | 'distance' | 'duration'): number {
  const u = String(units ?? '').toLowerCase()
  if (kind === 'energy') return u === 'kj' ? 1 / 4.184 : 1
  if (kind === 'mass') return u === 'lb' || u === 'lbs' ? 0.45359237 : u === 'g' ? 0.001 : 1
  if (kind === 'distance') return u === 'mi' ? 1609.344 : u === 'm' ? 1 : u === 'yd' ? 0.9144 : 1000 // 既定は km
  return u === 'min' ? 60 : u === 'hr' || u === 'h' ? 3600 : 1 // 既定は秒
}

type Day = Record<string, number | string | null>

class DayBuckets {
  daily = new Map<string, Day>()
  sleep = new Map<string, Day>()
  body = new Map<string, Day>()
  private sums = new Map<string, number[]>()

  set(map: Map<string, Day>, date: string, field: string, value: number | string | null) {
    if (value == null) return
    const d = map.get(date) ?? {}
    d[field] = value
    map.set(date, d)
  }
  add(map: Map<string, Day>, date: string, field: string, value: number | null) {
    if (value == null) return
    const d = map.get(date) ?? {}
    d[field] = round(Number(d[field] ?? 0) + value)
    map.set(date, d)
  }
  /** 同じ日に複数の値があれば平均 */
  avg(map: Map<string, Day>, date: string, field: string, value: number | null) {
    if (value == null) return
    const key = `${date}|${field}|${map === this.sleep ? 's' : map === this.body ? 'b' : 'd'}`
    const list = [...(this.sums.get(key) ?? []), value]
    this.sums.set(key, list)
    this.set(map, date, field, round(list.reduce((a, b) => a + b, 0) / list.length))
  }
}

/** Health Auto Export のワークアウト名 → 記録の種類 */
const CARDIO: [RegExp, string][] = [
  [/run|jog/i, 'run'],
  [/walk|hik/i, 'walk'],
  [/cycl|bik/i, 'bike'],
  [/row/i, 'row'],
  [/swim/i, 'swim'],
  [/ski/i, 'ski'],
  [/elliptical|stair/i, 'other'],
]
const WORKOUT: [RegExp, string][] = [
  [/functional|cross ?training|high intensity|hiit|mixed|crossfit/i, 'crossfit'],
  [/traditional strength|strength/i, 'strength'],
  [/yoga|flexib|cooldown|mind|pilates/i, 'mobility'],
  [/core/i, 'accessory'],
]

function workoutId(start: string): string {
  return 'hw-' + start.replace(/[^0-9]/g, '').slice(0, 14)
}

function timeOfDay(hhmm: string | null): string | null {
  if (!hhmm) return null
  const h = Number(hhmm.slice(0, 2))
  return h < 11 ? 'am' : h < 15 ? 'noon' : 'pm'
}

export function parseHealthPayload(body: unknown): ParsedHealth {
  const b = new DayBuckets()
  const ignored: string[] = []
  const cardio: Record<string, unknown>[] = []
  const workouts: Record<string, unknown>[] = []
  const root = body as Record<string, unknown> | unknown[] | null

  const isHae = !!root && !Array.isArray(root) && typeof root === 'object' && typeof (root as { data?: unknown }).data === 'object'
  if (isHae) {
    const data = (root as { data: { metrics?: unknown; workouts?: unknown } }).data
    for (const m of (Array.isArray(data.metrics) ? data.metrics : []) as { name?: string; units?: string; data?: Record<string, unknown>[] }[]) {
      const name = String(m.name ?? '')
      for (const p of Array.isArray(m.data) ? m.data : []) {
        const date = dateOf(p.date) ?? dateOf(p.sleepEnd) ?? dateOf(p.endDate)
        if (!date) continue
        const v = q(p.qty) ?? q(p.Avg) ?? q(p.avg)
        switch (name) {
          case 'step_count':
            b.add(b.daily, date, 'steps', v != null ? Math.round(v) : null)
            break
          case 'active_energy':
            b.add(b.daily, date, 'active_kcal', v != null ? v * unitScale(m.units, 'energy') : null)
            break
          case 'apple_exercise_time':
            b.add(b.daily, date, 'exercise_min', v)
            break
          case 'resting_heart_rate':
            b.avg(b.daily, date, 'resting_hr', v != null ? Math.round(v) : null)
            break
          case 'heart_rate_variability':
          case 'heart_rate_variability_sdnn':
            b.avg(b.daily, date, 'hrv_ms', v)
            break
          case 'vo2_max':
            b.avg(b.daily, date, 'vo2max', v)
            break
          case 'respiratory_rate':
            b.avg(b.daily, date, 'respiratory_rate', v)
            break
          case 'weight_body_mass':
          case 'body_mass':
            b.set(b.body, date, 'weight_kg', v != null ? round(v * unitScale(m.units, 'mass')) : null)
            break
          case 'body_fat_percentage':
            // 0〜1 の割合で来ることがある
            b.set(b.body, date, 'body_fat_pct', v != null ? round(v <= 1 ? v * 100 : v) : null)
            break
          case 'lean_body_mass':
            b.set(b.body, date, 'lean_mass_kg', v != null ? round(v * unitScale(m.units, 'mass')) : null)
            break
          case 'body_mass_index':
            b.set(b.body, date, 'bmi', v != null ? round(v) : null)
            break
          case 'sleep_analysis': {
            // 単位は時間。totalSleep (新しい版) か asleep、無ければ core+deep+rem
            const hours = q(p.totalSleep) ?? q(p.asleep) ?? ((q(p.core) ?? 0) + (q(p.deep) ?? 0) + (q(p.rem) ?? 0) || null)
            const toMin = (h: number | null) => (h != null ? Math.round(h * 60) : null)
            b.set(b.sleep, date, 'duration_min', toMin(hours))
            b.set(b.sleep, date, 'deep_min', toMin(q(p.deep)))
            b.set(b.sleep, date, 'rem_min', toMin(q(p.rem)))
            b.set(b.sleep, date, 'awake_min', toMin(q(p.awake)))
            b.set(b.sleep, date, 'bed_time', timeOf(p.sleepStart ?? p.inBedStart))
            b.set(b.sleep, date, 'wake_time', timeOf(p.sleepEnd ?? p.inBedEnd))
            break
          }
          default:
            if (!ignored.includes(name)) ignored.push(name)
        }
      }
    }
    for (const w of (Array.isArray(data.workouts) ? data.workouts : []) as Record<string, unknown>[]) {
      const start = String(w.start ?? w.startDate ?? '')
      const date = dateOf(start)
      if (!date) continue
      const name = String(w.name ?? 'Workout')
      const duration = q(w.duration) // 秒
      const avgHr = q(w.avgHeartRate) ?? q((w.heartRate as Record<string, unknown> | undefined)?.avg) ?? q(w.averageHeartRate)
      const maxHr = q(w.maxHeartRate) ?? q((w.heartRate as Record<string, unknown> | undefined)?.max)
      const energy = (w.activeEnergyBurned ?? w.activeEnergy) as { qty?: unknown; units?: string } | number | undefined
      const kcal = q(energy) != null ? Math.round(q(energy)! * unitScale(typeof energy === 'object' ? energy?.units : 'kcal', 'energy')) : null
      const dist = w.distance as { qty?: unknown; units?: string } | number | undefined
      const meters = q(dist) != null ? Math.round(q(dist)! * unitScale(typeof dist === 'object' ? dist?.units : 'km', 'distance')) : null
      const base = {
        id: workoutId(start),
        date,
        avg_hr: avgHr != null ? Math.round(avgHr) : null,
        max_hr: maxHr != null ? Math.round(maxHr) : null,
        calories: kcal,
        source: 'health',
      }
      const modality = CARDIO.find(([re]) => re.test(name))?.[1]
      if (modality) {
        cardio.push({ ...base, modality, distance_m: meters, duration_s: duration != null ? Math.round(duration) : null, note: `Apple Watch: ${name}` })
      } else {
        workouts.push({
          ...base,
          type: WORKOUT.find(([re]) => re.test(name))?.[1] ?? 'other',
          time_of_day: timeOfDay(timeOf(start)),
          title: `Apple Watch: ${name}`,
          duration_min: duration != null ? round(duration / 60) : null,
        })
      }
    }
  } else {
    const list = (Array.isArray(root) ? root : [root]) as Record<string, unknown>[]
    const map: Record<string, ['daily' | 'sleep' | 'body', string, (v: number) => number]> = {
      steps: ['daily', 'steps', Math.round],
      active_kcal: ['daily', 'active_kcal', v => round(v)],
      exercise_min: ['daily', 'exercise_min', v => round(v)],
      resting_hr: ['daily', 'resting_hr', Math.round],
      hrv_ms: ['daily', 'hrv_ms', v => round(v)],
      vo2max: ['daily', 'vo2max', v => round(v)],
      respiratory_rate: ['daily', 'respiratory_rate', v => round(v)],
      sleep_min: ['sleep', 'duration_min', Math.round],
      sleep_hours: ['sleep', 'duration_min', v => Math.round(v * 60)],
      deep_min: ['sleep', 'deep_min', Math.round],
      rem_min: ['sleep', 'rem_min', Math.round],
      weight_kg: ['body', 'weight_kg', v => round(v)],
      body_fat_pct: ['body', 'body_fat_pct', v => round(v <= 1 ? v * 100 : v)],
      muscle_kg: ['body', 'muscle_kg', v => round(v)],
      lean_mass_kg: ['body', 'lean_mass_kg', v => round(v)],
      bmi: ['body', 'bmi', v => round(v)],
    }
    for (const item of list) {
      if (!item || typeof item !== 'object') continue
      const date = dateOf(item.date)
      if (!date) {
        ignored.push('date が YYYY-MM-DD ではない行')
        continue
      }
      for (const [k, raw] of Object.entries(item)) {
        if (k === 'date') continue
        if (k === 'bed_time' || k === 'wake_time') {
          b.set(b.sleep, date, k, timeOf(` ${raw}`) ?? null)
          continue
        }
        const spec = map[k]
        const v = q(raw)
        if (!spec) {
          if (!ignored.includes(k)) ignored.push(k)
          continue
        }
        if (v == null) continue
        const target = spec[0] === 'daily' ? b.daily : spec[0] === 'sleep' ? b.sleep : b.body
        b.set(target, date, spec[1], spec[2](v))
      }
    }
  }

  const toRows = (m: Map<string, Day>, prefix: string) =>
    [...m.entries()]
      .filter(([, d]) => Object.values(d).some(v => v != null))
      .map(([date, d]) => ({ id: `h-${prefix}-${date}`, date, ...d, source: 'health' }))

  return {
    rows: {
      daily_health: toRows(b.daily, 'day'),
      sleep_logs: toRows(b.sleep, 'sleep'),
      body_metrics: toRows(b.body, 'body'),
      cardio_sessions: cardio,
      workouts,
    },
    ignored,
    format: isHae ? 'health_auto_export' : 'simple',
  }
}
