// デプロイ前後で本番 DB の行数を比べ、減っていたら失敗させる (データが消えていないことの確認)。
//   node scripts/ci-count-rows.mjs save   → out/rows-before.json
//   node scripts/ci-count-rows.mjs check  → 前回と比較
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const sql = readFileSync('migrations/0001_init.sql', 'utf8')
const tables = [...sql.matchAll(/CREATE TABLE (\w+)/g)].map(m => m[1])
const query = tables.map(t => `SELECT '${t}' AS t, COUNT(*) AS n FROM ${t}`).join(' UNION ALL ')
let rows = []
try {
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'cf-memo', '--remote', '--json', '--command', query], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  rows = JSON.parse(out)[0].results
} catch (e) {
  // 初回デプロイ (まだテーブルが無い) のときだけ許す
  if (process.argv[2] === 'save' && /no such table/i.test(String(e.stdout) + String(e.stderr))) console.log('初回デプロイのためテーブルなし')
  else throw e
}
const now = Object.fromEntries(rows.map(r => [r.t, r.n]))
mkdirSync('out', { recursive: true })
if (process.argv[2] === 'save') {
  writeFileSync('out/rows-before.json', JSON.stringify(now))
  console.log('デプロイ前の行数:', now)
} else {
  const before = JSON.parse(readFileSync('out/rows-before.json', 'utf8'))
  const lost = Object.entries(before).filter(([t, n]) => (now[t] ?? 0) < n)
  console.log('デプロイ後の行数:', now)
  if (lost.length) {
    console.error(`::error::行数が減っています: ${lost.map(([t, n]) => `${t} ${n}→${now[t] ?? 0}`).join(', ')}。デプロイ前のバックアップ (Artifacts) から復元を検討してください`)
    process.exit(1)
  }
  console.log('✔ どのテーブルも行数は減っていません')
}
