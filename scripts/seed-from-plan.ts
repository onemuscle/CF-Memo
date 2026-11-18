/**
 * 旧アプリの12週プラン (src/plan/planData.ts) から、確定している情報だけを本番 DB に登録する。
 * 初回デプロイ後に1回だけ実行する想定。固定の id を使うので、何度実行しても二重登録にならない。
 *
 *   npm run cfm -- doctor            (接続確認)
 *   node scripts/seed-from-plan.ts --dry-run
 *   node scripts/seed-from-plan.ts
 *
 * 登録するもの:
 *   - 開始時の体組成 (2026-08-13)
 *   - 栄養目標 食A / 食B / 食C (2026-08-13 適用開始・減量期)
 *   - プロフィールのトレーニング方針・食事の方針・週のスケジュール (未登録の項目だけ)
 *   - 12週プランの概要 (ノート / 方針・決定)
 * 目標 (goals) は12週プランが終わっているため登録しない。ユーザーに確認してから登録する。
 */
process.env.TZ = 'Asia/Tokyo'
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ADJUST_RULES, GOAL_BAND, MEALS, PLAN_PERIOD, PLAN_PURPOSE, START_STATS, START_WEIGHT, TOP_RULES, WEEKLY_CHECKS, REVIEW_CHECKS } from '../src/plan/planData.ts'

const dry = process.argv.includes('--dry-run')
const range = (s: string) => {
  const nums = s.replace(/,/g, '').match(/\d+(\.\d+)?/g)?.map(Number) ?? []
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null
}

const items: { entity: string; data: Record<string, unknown> }[] = [
  {
    entity: 'body_metrics',
    data: { id: 'plan12w-start-body', date: '2026-08-13', weight_kg: START_WEIGHT, body_fat_pct: 14.7, lean_mass_kg: 75.3, muscle_kg: 71.6, bmi: 26.4, note: START_STATS, source: 'import' },
  },
  ...Object.entries(MEALS).map(([key, m]) => ({
    entity: 'nutrition_targets',
    data: {
      id: `plan12w-${key === '食A' ? 'a' : key === '食B' ? 'b' : 'c'}`,
      start_date: '2026-08-13',
      phase: 'cut',
      day_type: `${key}: ${m.target}`,
      kcal: range(m.total.kcal ?? m.total.food),
      protein_g: range(m.total.p),
      fat_g: range(m.total.f),
      carbs_g: range(m.total.c),
      note: `12週プランの${key} (${m.total.food} / P${m.total.p} F${m.total.f} C${m.total.c})`,
      source: 'import',
    },
  })),
  {
    entity: 'journal',
    data: {
      id: 'plan12w-summary',
      date: '2026-08-13',
      category: 'decision',
      title: '12週プラン (CrossFit × Bodymake) の方針',
      body: [
        PLAN_PERIOD,
        '',
        '目的:',
        ...PLAN_PURPOSE.map(p => `- ${p}`),
        `- 目標体重帯: ${GOAL_BAND}`,
        '',
        '最優先ルール:',
        ...TOP_RULES.map(p => `- ${p}`),
        '',
        '週次チェック:',
        ...WEEKLY_CHECKS.map(p => `- ${p}`),
        '',
        '調整ルール:',
        ...ADJUST_RULES.map(p => `- ${p}`),
        '',
        '12週レビューで見ること:',
        ...REVIEW_CHECKS.map(p => `- ${p}`),
      ].join('\n'),
      tags: ['12週プラン'],
      source: 'import',
    },
  },
]

const profile: Record<string, string> = {
  weekly_schedule: '(12週プラン時点) 朝CrossFit + 夜Bodymake補助/ラン。金曜は完全休養。土日両方CrossFitの週は土曜の補助を削除。22:00就寝。夜トレは45〜50分以内。補助トレの場所は Jexer か家ジム',
  training_policy: TOP_RULES.join(' / '),
  nutrition_policy: [...ADJUST_RULES, '体重は毎朝 (起床→トイレ→飲食前) 測り7日平均で見る'].join(' / '),
}

const dir = mkdtempSync(join(tmpdir(), 'seed-'))
const file = join(dir, 'items.json')
writeFileSync(file, JSON.stringify({ items }))
const cfm = (args: string[]) => execFileSync('node', ['scripts/cfm.ts', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })

console.log(cfm(['batch', file, ...(dry ? ['--dry-run'] : [])]))
const current = JSON.parse(cfm(['profile'])) as Record<string, unknown>
for (const [k, v] of Object.entries(profile)) {
  if (current[k]) {
    console.log(`- profile.${k} は登録済みなので上書きしません`)
    continue
  }
  if (dry) console.log(`- profile.${k} を登録予定`)
  else console.log(cfm(['profile', 'set', k, v]).trim())
}
