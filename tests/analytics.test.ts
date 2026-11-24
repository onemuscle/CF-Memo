import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, goalProgress, liftSummaries, loadStatus, nutritionByDay, prEvents, project, readiness, periodSummary, weekStart, type Bundle } from '../shared/analytics.ts'
import { applyComputed, estimate1RM } from '../shared/schema.ts'
import { validate } from '../shared/validate.ts'

const set = (date: string, w: number, reps: number) => applyComputed('strength_sets', { date, movement: 'Back Squat', weight_kg: w, reps })

test('推定1RM: Epley式、1回はそのまま、11回以上は出さない', () => {
  assert.equal(estimate1RM(120, 5), 140)
  assert.equal(estimate1RM(100, 1), 100)
  assert.equal(estimate1RM(100, 12), null)
})

test('自己ベスト: 推定1RMと回数別の更新を検出する', () => {
  const sets = [set('2026-10-01', 110, 5), set('2026-10-08', 115, 5), set('2026-10-15', 112, 5)]
  const ev = prEvents(sets, '2026-10-01', '2026-10-31')
  assert.equal(ev.filter(e => e.kind === 'e1rm').length, 1)
  assert.equal(ev.find(e => e.kind === 'rep_max')?.value, 115)
  const L = liftSummaries(sets)[0]
  assert.equal(L.bestE1rm, estimate1RM(115, 5))
  assert.equal(L.repMaxes[5].weight, 115)
})

test('予測: データ不足なら数字を出さない', () => {
  const p = project([{ date: '2026-10-01', value: 100 }, { date: '2026-10-05', value: 101 }], [90], '2026-10-05')
  assert.equal(p[0].status, 'insufficient')
})

test('予測: 伸びは頭打ちになり、先ほど幅が広がる', () => {
  const series = Array.from({ length: 10 }, (_, i) => ({ date: addDays('2026-07-01', i * 10), value: 100 + i }))
  const [p90, p365] = project(series, [90, 365], '2026-10-01', { saturationDays: 180 })
  assert.equal(p90.status, 'ok')
  const linear365 = 109 + 0.1 * 365
  assert.ok(p365.value! < linear365, '直線より控えめ')
  assert.ok(p365.high! - p365.low! > p90.high! - p90.low!, '先ほど幅が広い')
})

test('負荷比: 記録が少ないと null、急増で high 以上', () => {
  const asOf = '2026-11-17'
  const workouts = []
  for (let k = 27; k >= 7; k--) workouts.push(applyComputed('workouts', { date: addDays(asOf, -k), type: 'crossfit', duration_min: 60, rpe: 5 }))
  for (let k = 6; k >= 0; k--) workouts.push(applyComputed('workouts', { date: addDays(asOf, -k), type: 'crossfit', duration_min: 90, rpe: 9 }))
  const b: Bundle = { profile: {}, data: { workouts } }
  const ls = loadStatus(b, asOf)
  assert.ok(ls.acwr! > 1.5)
  assert.equal(ls.zone, 'very_high')
  assert.equal(loadStatus({ profile: {}, data: { workouts: workouts.slice(-3) } }, asOf).acwr, null)
})

test('コンディション: 睡眠6時間未満で注意を出す', () => {
  const b: Bundle = { profile: {}, data: { sleep_logs: [{ date: '2026-11-17', duration_min: 340 }], wellness: [{ date: '2026-11-17', fatigue: 4, soreness: 2 }] } }
  const r = readiness(b, '2026-11-17')
  assert.ok(r.score! < 75)
  assert.ok(r.advice.some(a => a.includes('6時間未満')))
})

test('栄養: 1日合計の行があればそれを優先', () => {
  const d = nutritionByDay([
    { date: '2026-11-17', meal: 'breakfast', kcal: 600, protein_g: 40 },
    { date: '2026-11-17', meal: 'day_total', kcal: 3000, protein_g: 195 },
  ])
  assert.equal(d[0].kcal, 3000)
})

test('目標: 推定1RMの達成率', () => {
  const sets = [set('2026-09-01', 110, 5), set('2026-10-01', 115, 5), set('2026-10-20', 118, 5), set('2026-11-10', 120, 5)]
  const g = goalProgress({ profile: {}, data: { strength_sets: sets } }, { metric: 'e1rm:back squat', start_value: 128, target_value: 160, target_date: '2027-06-30', unit: 'kg' }, '2026-11-17')
  assert.equal(g.current, 140)
  assert.equal(g.pct, 38)
})

test('期間サマリー', () => {
  const b: Bundle = { profile: {}, data: { workouts: [applyComputed('workouts', { date: '2026-11-17', type: 'crossfit', duration_min: 60, rpe: 8 })], sleep_logs: [{ date: '2026-11-17', duration_min: 420 }] } }
  const p = periodSummary(b, weekStart('2026-11-17'), '2026-11-23')
  assert.equal(p.sessions, 1)
  assert.equal(p.load, 480)
  assert.equal(p.avgSleepMin, 420)
})

test('入力検証: 未知の項目・範囲外・必須漏れを弾く', () => {
  assert.equal(validate('sleep_logs', { date: '2026-11-17', duration_min: 360 }).ok, true)
  const v = validate('sleep_logs', { duration_min: 99999, typo: 1 })
  assert.equal(v.ok, false)
  assert.equal(v.errors.length, 3)
  assert.equal(validate('workouts', { date: '2026/11/17', type: 'crossfit' }).ok, false)
  assert.equal(validate('wellness', { date: '2026-11-17', sick: 'true' }).values.sick, 1)
})

test('予測: 急な伸びは年間上限で抑える', () => {
  const series = Array.from({ length: 8 }, (_, i) => ({ date: addDays('2026-09-01', i * 10), value: 150 + i * 5 }))
  const [p] = project(series, [365], '2026-11-10', { saturationDays: 180, capPerYear: 0.1 })
  assert.equal(p.capped, true)
  assert.ok(p.value! <= 185 * 1.1 + 0.1)
})

test('コンディション: 平均点が高くても睡眠不足なら「攻めてOK」にしない', () => {
  const b: Bundle = { profile: {}, data: { sleep_logs: [{ date: '2026-11-17', duration_min: 340 }], wellness: [{ date: '2026-11-17', fatigue: 1, soreness: 1, stress: 1, motivation: 5 }] } }
  const r = readiness(b, '2026-11-17')
  assert.ok(r.score! >= 75)
  assert.equal(r.level, 'easy')
})

test('種目カタログ: 英語表記が重複せず、日本語を引ける', async () => {
  const { MOVEMENT_CATALOG, SKILL_CATALOG, jaName } = await import('../shared/movements.ts')
  const names = [...MOVEMENT_CATALOG, ...SKILL_CATALOG].flatMap(g => g.items.map(([en]) => en.toLowerCase()))
  assert.equal(new Set(names).size, names.length)
  assert.equal(jaName('back squat'), 'バックスクワット')
})
