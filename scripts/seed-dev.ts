// ローカル開発用のサンプルデータ投入 (http://localhost:8787 専用。本番には絶対に向けない)
// 使い方: npm run dev:api を起動した状態で `node scripts/seed-dev.ts`
import { addDays, todayISO } from '../shared/analytics.ts'

const BASE = process.env.CFM_SEED_URL ?? 'http://localhost:8787'
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(BASE)) throw new Error('seed-dev はローカル専用です')

const items: { entity: string; data: Record<string, unknown> }[] = []
const today = todayISO()
let rnd = 42
const r = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647)
for (let k = 70; k >= 0; k--) {
  const d = addDays(today, -k)
  const dow = new Date(d + 'T00:00:00').getDay()
  items.push({ entity: 'body_metrics', data: { date: d, weight_kg: Math.round((88.3 - (70 - k) * 0.035 + (r() - 0.5) * 0.9) * 10) / 10, ...(k % 7 === 0 ? { body_fat_pct: Math.round((14.7 - (70 - k) * 0.012) * 10) / 10, muscle_kg: 71.6, waist_cm: Math.round((86 - (70 - k) * 0.02) * 10) / 10 } : {}) } })
  items.push({ entity: 'sleep_logs', data: { date: d, duration_min: Math.round(330 + r() * 120), quality: 2 + Math.floor(r() * 3), hrv_ms: Math.round(55 + r() * 20), resting_hr: Math.round(50 + r() * 6) } })
  items.push({ entity: 'wellness', data: { date: d, fatigue: 1 + Math.floor(r() * 4), soreness: 1 + Math.floor(r() * 4), stress: 1 + Math.floor(r() * 3), motivation: 3 + Math.floor(r() * 3) } })
  if (dow !== 5) items.push({ entity: 'workouts', data: { date: d, type: 'crossfit', time_of_day: 'am', title: ['Fran', 'Helen', 'Grace', 'Cindy', 'DT', 'Karen'][k % 6], description: '21-15-9\nThruster 43kg\nPull-up', result: `${4 + Math.floor(r() * 4)}:${String(Math.floor(r() * 60)).padStart(2, '0')}`, duration_min: 60, rpe: 6 + Math.floor(r() * 4) } })
  if (dow === 1 || dow === 4) items.push({ entity: 'strength_sets', data: { date: d, movement: 'Back Squat', weight_kg: 110 + Math.round((70 - k) / 7) * 2.5, reps: 5, sets: 3, rpe: 8 } })
  if (dow === 2) items.push({ entity: 'strength_sets', data: { date: d, movement: 'Deadlift', weight_kg: 150 + Math.round((70 - k) / 14) * 5, reps: 3, sets: 3, rpe: 8 } })
  if (dow === 3) items.push({ entity: 'strength_sets', data: { date: d, movement: 'Front Squat', weight_kg: 95 + Math.round((70 - k) / 14) * 2.5, reps: 3, sets: 3, rpe: 8 } })
  if (dow === 2 || dow === 6) items.push({ entity: 'cardio_sessions', data: { date: d, modality: 'run', kind: dow === 2 ? 'easy' : 'tempo', distance_m: dow === 2 ? 6000 : 5000, duration_s: dow === 2 ? 2280 - (70 - k) * 3 : 1500 - (70 - k), avg_hr: dow === 2 ? 142 : 168, rpe: dow === 2 ? 4 : 8 } })
  items.push({ entity: 'nutrition_entries', data: { date: d, meal: 'day_total', kcal: Math.round(2700 + r() * 500), protein_g: Math.round(170 + r() * 35), fat_g: Math.round(65 + r() * 20), carbs_g: Math.round(300 + r() * 120) } })
  if (k % 10 === 0) items.push({ entity: 'skill_logs', data: { date: d, skill: 'Ring Muscle-up', level: k > 30 ? 'first' : 'inconsistent', reps: 5, max_unbroken: k > 30 ? 1 : 2 } })
}
items.push({ entity: 'nutrition_targets', data: { start_date: addDays(today, -70), phase: 'cut', kcal: 2950, protein_g: 195, fat_g: 75, carbs_g: 360 } })
items.push({ entity: 'goals', data: { title: 'Back Squat 推定1RM 160kg', category: 'strength', metric: 'e1rm:back squat', target_value: 160, unit: 'kg', target_date: addDays(today, 240), status: 'active', priority: 1 } })
items.push({ entity: 'goals', data: { title: '体重 85kg (7日平均)', category: 'body', metric: 'weight', start_value: 88.3, target_value: 85, unit: 'kg', direction: 'down', target_date: addDays(today, 90), status: 'active', priority: 2 } })
items.push({ entity: 'goals', data: { title: 'Ring Muscle-up 5回連続', category: 'skill', metric: 'skill:ring muscle-up', target_value: 5, unit: '回', target_date: addDays(today, 180), status: 'active', priority: 3 } })
items.push({ entity: 'races', data: { date: addDays(today, 60), name: 'HYROX (サンプル)', race_type: 'hyrox', status: 'planned', division: 'Open', target_text: '1:20:00' } })
items.push({ entity: 'injuries', data: { started_on: addDays(today, -20), body_part: '腰', description: 'デッドリフト高回数のあと張り', severity: 2, status: 'recovering', avoid: '高回数のヒンジ' } })

for (let i = 0; i < items.length; i += 20) {
  const res = await fetch(`${BASE}/api/batch`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CFM-Client': '1' }, body: JSON.stringify({ items: items.slice(i, i + 20) }) })
  if (!res.ok) console.error(await res.text())
}
console.log(`${items.length} 件投入`)
