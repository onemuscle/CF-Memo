/**
 * データ永続性・バックアップ・認証の結合テスト (ローカルの Cloudflare 環境で実行)
 *
 *   npm run test:persistence
 *
 * 専用の一時フォルダにローカル D1 を作るので、開発中のデータには触れない。
 * 確認すること:
 *   1. 認証なし・誤ったトークンは 401、正しいトークンだけ通る
 *   2. 書いたデータが、サーバーを止めて再起動 (= 再デプロイ相当) しても残る
 *   3. スキーマ変更 (列の追加) をしても既存データが残り、アプリも動く
 *   4. 書き出し → 空のデータベースに取り込み で全件が復元される (JSON バックアップ)
 *   5. wrangler d1 export の SQL ダンプから別のデータベースに復元できる (自動バックアップの経路)
 *   6. 削除はゴミ箱に入るだけで、戻せる。変更履歴から取り消せる
 */
import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, existsSync, cpSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { runImport } from '../shared/importer.ts'

const TOKEN = 'test-token-' + 'x'.repeat(40)
const PORT = 8799
const BASE = `http://127.0.0.1:${PORT}`
const work = mkdtempSync(join(tmpdir(), 'cfm-persist-'))
const dbA = join(work, 'a')
const dbB = join(work, 'b')
const dbC = join(work, 'c')
let passed = 0

function step(name: string) {
  console.log(`\n▶ ${name}`)
}
function ok(msg: string) {
  passed++
  console.log(`  ✔ ${msg}`)
}

const WRANGLER = join(process.cwd(), 'node_modules', '.bin', 'wrangler')
function wrangler(args: string[], cwd = process.cwd()) {
  return execFileSync(WRANGLER, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], cwd })
}

function migrate(dir: string) {
  wrangler(['d1', 'migrations', 'apply', 'cf-memo', '--local', '--persist-to', dir])
}

async function start(dir: string): Promise<ChildProcess> {
  const p = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--persist-to', dir, '--var', `API_TOKEN:${TOKEN}`, '--var', 'DEV_AUTH_BYPASS:0'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  })
  let log = ''
  p.stdout!.on('data', d => (log += d))
  p.stderr!.on('data', d => (log += d))
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`)
      if (r.ok) return p
    } catch {
      /* 起動待ち */
    }
    await new Promise(r => setTimeout(r, 500))
  }
  console.error(log)
  throw new Error('wrangler dev が起動しませんでした')
}

async function stop(p: ChildProcess) {
  try {
    process.kill(-p.pid!, 'SIGTERM')
  } catch {
    /* 終了済み */
  }
  await new Promise(r => setTimeout(r, 1200))
}

async function api<T = unknown>(method: string, path: string, body?: unknown, token: string | null = TOKEN): Promise<{ status: number; json: T }> {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const r = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  return { status: r.status, json: (await r.json().catch(() => null)) as T }
}

async function counts(): Promise<Record<string, number>> {
  const r = await api<{ counts: Record<string, { n: number }> }>('GET', '/api/meta')
  return Object.fromEntries(Object.entries(r.json.counts).map(([k, v]) => [k, v.n]))
}

let server: ChildProcess | null = null
try {
  if (!existsSync('dist-platform/index.html')) execFileSync('npm', ['run', 'build:platform'], { stdio: 'inherit' })

  step('準備: 空のデータベースにマイグレーションを適用')
  migrate(dbA)
  server = await start(dbA)
  ok('起動')

  step('1. 認証')
  assert.equal((await api('GET', '/api/meta', undefined, null)).status, 401)
  ok('トークンなし → 401')
  assert.equal((await api('GET', '/api/meta', undefined, 'wrong-token-' + 'y'.repeat(40))).status, 401)
  ok('誤ったトークン → 401')
  assert.equal((await api('GET', '/api/meta')).status, 200)
  ok('正しいトークン → 200')
  assert.equal((await api('GET', '/api/health', undefined, null)).status, 200)
  ok('稼働確認 (/api/health) だけは認証なしで 200 (中身は返さない)')

  step('2. 書き込み → 再起動 (再デプロイ相当) → 残っているか')
  const w = await api<{ results: { row: { id: string } }[] }>('POST', '/api/batch', {
    items: [
      { entity: 'strength_sets', data: { id: 'persist-1', date: '2026-11-17', movement: 'Back Squat', weight_kg: 120, reps: 5 } },
      { entity: 'sleep_logs', data: { date: '2026-11-16', duration_min: 360 } },
      { entity: 'goals', data: { title: 'Back Squat 160kg', metric: 'e1rm:back squat', target_value: 160, status: 'active' } },
    ],
  })
  assert.equal(w.status, 201)
  await api('PUT', '/api/profile/long_term_goals', { value: 'テスト' })
  const att = await fetch(`${BASE}/api/attachments?id=persist-img`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'image/png' }, body: readFileSync('platform/public/icon.svg') })
  assert.equal(att.status, 415) // SVG は受け付けない
  const png = await fetch(`${BASE}/api/attachments?id=persist-img`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'image/png' }, body: readFileSync('public/workout/apple-touch-icon.png') })
  assert.equal(png.status, 201)
  const before = await counts()
  await stop(server)
  server = await start(dbA)
  const after = await counts()
  assert.deepEqual(after, before)
  const row = await api<{ row: { weight_kg: number; e1rm_kg: number } }>('GET', '/api/e/strength_sets/persist-1')
  assert.equal(row.json.row.weight_kg, 120)
  assert.equal(row.json.row.e1rm_kg, 140)
  ok(`再起動後も全件残っている (${Object.values(after).reduce((a, b) => a + b, 0)}件・写真・プロフィール含む)`)

  step('3. スキーマ変更 (列の追加) をしても既存データが残る')
  await stop(server)
  wrangler(['d1', 'execute', 'cf-memo', '--local', '--persist-to', dbA, '--command', 'ALTER TABLE strength_sets ADD COLUMN tempo TEXT'])
  server = await start(dbA)
  assert.equal((await api<{ row: { weight_kg: number } }>('GET', '/api/e/strength_sets/persist-1')).json.row.weight_kg, 120)
  assert.equal((await api('POST', '/api/e/strength_sets', { date: '2026-11-18', movement: 'Deadlift', weight_kg: 180, reps: 3 })).status, 201)
  ok('列追加後も既存データは残り、新しい記録も保存できる')

  step('4. ゴミ箱と取り消し')
  assert.equal((await api('DELETE', '/api/e/strength_sets/persist-1')).status, 200)
  assert.equal((await api<{ rows: unknown[] }>('GET', '/api/e/strength_sets?deleted=1')).json.rows.length, 1)
  assert.equal((await api('POST', '/api/e/strength_sets/persist-1/restore')).status, 200)
  ok('削除 → ゴミ箱 → 復元')
  assert.equal((await api('PATCH', '/api/e/strength_sets/persist-1', { weight_kg: 250 })).status, 200)
  const audit = await api<{ rows: { seq: number; action: string }[] }>('GET', '/api/audit?table=strength_sets&row_id=persist-1')
  const upd = audit.json.rows.find(a => a.action === 'update')!
  await api('POST', `/api/audit/${upd.seq}/revert`)
  assert.equal((await api<{ row: { weight_kg: number } }>('GET', '/api/e/strength_sets/persist-1')).json.row.weight_kg, 120)
  ok('誤って上書きした値を、変更履歴から元に戻せる')

  step('5. JSON バックアップ → 空のデータベースへ復元')
  const exp = await api<{ tables: Record<string, Record<string, unknown>[]>; profile: { key: string; value: string; updated_at: string }[]; attachments: { id: string; mime: string; data_base64: string }[] }>('GET', '/api/export')
  const sourceCounts = await counts()
  await stop(server)
  migrate(dbB)
  server = await start(dbB)
  const post = async <T,>(p: string, b: unknown) => (await api<T>('POST', p, b)).json
  const r = await runImport({ tables: exp.json.tables, profile: exp.json.profile, attachments: exp.json.attachments }, post)
  assert.equal(r.errors.length, 0, r.errors.join('\n'))
  assert.deepEqual(await counts(), sourceCounts)
  const prof = await api<{ profile: Record<string, unknown> }>('GET', '/api/profile')
  assert.equal(prof.json.profile.long_term_goals, 'テスト')
  assert.equal((await fetch(`${BASE}/api/attachments/persist-img`, { headers: { Authorization: `Bearer ${TOKEN}` } })).status, 200)
  ok('全件・プロフィール・写真が復元された')
  const again = await runImport({ tables: exp.json.tables }, post)
  assert.equal(again.inserted, 0)
  ok('同じバックアップをもう一度取り込んでも二重登録されない')

  step('6. SQL ダンプ (自動バックアップの形式) から復元')
  await stop(server)
  server = null
  const dump = join(work, 'dump.sql')
  // d1 export は --persist-to に対応していないので、DB の状態を一時プロジェクトの既定の場所に写して書き出す
  const proj = join(work, 'proj')
  mkdirSync(proj)
  cpSync(dbA, join(proj, '.wrangler', 'state'), { recursive: true })
  writeFileSync(join(proj, 'wrangler.json'), JSON.stringify({ name: 'cf-memo-dump', compatibility_date: '2026-11-01', d1_databases: [{ binding: 'DB', database_name: 'cf-memo', database_id: '00000000-0000-0000-0000-000000000000' }] }))
  wrangler(['d1', 'export', 'cf-memo', '--local', '--output', dump], proj)
  wrangler(['d1', 'execute', 'cf-memo', '--local', '--persist-to', dbC, '--file', dump])
  server = await start(dbC)
  const restored = await counts()
  assert.equal(restored.strength_sets, sourceCounts.strength_sets)
  assert.equal((await api<{ row: { weight_kg: number } }>('GET', '/api/e/strength_sets/persist-1')).json.row.weight_kg, 120)
  ok('SQL ダンプから別のデータベースに復元できた')

  step('7. Apple ヘルスケアの取り込み (二重登録しない)・WOD 読み取り (キー未設定)')
  const hp = { date: '2026-11-18', sleep_hours: 6.5, hrv_ms: 58, resting_hr: 52, steps: 8000, weight_kg: 86.4 }
  const h1 = await api<{ inserted: number }>('POST', '/api/ingest/health', hp)
  assert.equal(h1.json.inserted, 3)
  const h2 = await api<{ inserted: number; unchanged: number }>('POST', '/api/ingest/health', hp)
  assert.equal(h2.json.inserted, 0)
  assert.equal(h2.json.unchanged, 3)
  ok('同じヘルスケアデータを2回送っても1回分だけ')
  assert.equal((await api('POST', '/api/wod/scan', { attachment_id: 'persist-img' })).status, 503)
  ok('API キー未設定なら WOD 読み取りは 503 で理由を返す')

  console.log(`\n✅ 永続性テスト: ${passed} 項目すべて成功`)
} catch (e) {
  console.error('\n❌ 失敗:', e)
  process.exitCode = 1
} finally {
  if (server) await stop(server)
  rmSync(work, { recursive: true, force: true })
}
