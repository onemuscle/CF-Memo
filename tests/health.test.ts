import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseHealthPayload } from '../shared/health.ts'
import { dedupeHealth, periodSummary } from '../shared/analytics.ts'
import { validate } from '../shared/validate.ts'
import { applyComputed } from '../shared/schema.ts'

test('かんたん形式: 睡眠・日次・体組成に振り分ける', () => {
  const p = parseHealthPayload({ date: '2026-11-18', sleep_hours: 6.5, hrv_ms: '58', resting_hr: 52.4, steps: 8200, weight_kg: 86.42, body_fat_pct: 0.142, foo: 1 })
  assert.equal(p.format, 'simple')
  assert.deepEqual(p.rows.sleep_logs[0], { id: 'h-sleep-2026-11-18', date: '2026-11-18', duration_min: 390, source: 'health' })
  assert.equal(p.rows.daily_health[0].resting_hr, 52)
  assert.equal(p.rows.body_metrics[0].weight_kg, 86.4)
  assert.equal(p.rows.body_metrics[0].body_fat_pct, 14.2)
  assert.deepEqual(p.ignored, ['foo'])
})

test('Health Auto Export 形式: 指標とワークアウト', () => {
  const p = parseHealthPayload({
    data: {
      metrics: [
        { name: 'step_count', units: 'count', data: [{ date: '2026-11-18 00:00:00 +0900', qty: 5000 }, { date: '2026-11-18 12:00:00 +0900', qty: 3000 }] },
        { name: 'active_energy', units: 'kJ', data: [{ date: '2026-11-18 00:00:00 +0900', qty: 4184 }] },
        { name: 'heart_rate_variability', units: 'ms', data: [{ date: '2026-11-18 00:00:00 +0900', qty: 50 }, { date: '2026-11-18 06:00:00 +0900', qty: 60 }] },
        { name: 'sleep_analysis', units: 'hr', data: [{ date: '2026-11-18 00:00:00 +0900', totalSleep: 6.25, deep: 1, rem: 1.5, sleepStart: '2026-11-17 23:10:00 +0900', sleepEnd: '2026-11-18 05:40:00 +0900' }] },
        { name: 'weight_body_mass', units: 'lb', data: [{ date: '2026-11-18 06:00:00 +0900', qty: 190 }] },
        { name: 'dietary_water', units: 'mL', data: [{ date: '2026-11-18 00:00:00 +0900', qty: 1 }] },
      ],
      workouts: [
        { name: 'Functional Strength Training', start: '2026-11-18 06:30:00 +0900', end: '2026-11-18 07:30:00 +0900', duration: 3600, avgHeartRate: { qty: 141.6, units: 'bpm' }, maxHeartRate: { qty: 182 }, activeEnergyBurned: { qty: 650, units: 'kcal' } },
        { name: 'Outdoor Run', start: '2026-11-18 19:00:00 +0900', duration: 1800, distance: { qty: 5.2, units: 'km' }, heartRate: { avg: { qty: 150 }, max: { qty: 171 } } },
      ],
    },
  })
  assert.equal(p.format, 'health_auto_export')
  const day = p.rows.daily_health[0]
  assert.equal(day.steps, 8000)
  assert.equal(day.active_kcal, 1000)
  assert.equal(day.hrv_ms, 55)
  const sleep = p.rows.sleep_logs[0]
  assert.equal(sleep.duration_min, 375)
  assert.equal(sleep.bed_time, '23:10')
  assert.equal(sleep.wake_time, '05:40')
  assert.equal(p.rows.body_metrics[0].weight_kg, 86.2)
  assert.equal(p.rows.workouts[0].type, 'crossfit')
  assert.equal(p.rows.workouts[0].time_of_day, 'am')
  assert.equal(p.rows.workouts[0].avg_hr, 142)
  assert.equal(p.rows.cardio_sessions[0].modality, 'run')
  assert.equal(p.rows.cardio_sessions[0].distance_m, 5200)
  assert.equal(p.rows.cardio_sessions[0].avg_hr, 150)
  assert.deepEqual(p.ignored, ['dietary_water'])
  for (const [name, rows] of Object.entries(p.rows)) for (const r of rows) assert.ok(validate(name as never, r).ok, `${name}: ${validate(name as never, r).errors}`)
})

test('Apple Watch と手入力が同じ日にあれば、集計では手入力を優先', () => {
  const w = (source: string) => applyComputed('workouts', { date: '2026-11-18', type: 'crossfit', duration_min: 60, rpe: 8, source })
  const b = { profile: {}, data: { workouts: [w('web'), w('health')] } }
  assert.equal(dedupeHealth(b).data.workouts.length, 1)
  assert.equal(periodSummary(b, '2026-11-18', '2026-11-18').sessions, 1)
})
