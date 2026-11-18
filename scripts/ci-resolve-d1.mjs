// GitHub Actions 用: Cloudflare 上の D1 データベース "cf-memo" の ID を調べ (無ければ作り)、
// wrangler.jsonc の仮の ID を置き換える。リポジトリには仮の ID のままにしておく。
// 既存のデータベースがあれば必ずそれを使う (作り直さない = データは消えない)。
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const NAME = 'cf-memo'
const PLACEHOLDER = '00000000-0000-0000-0000-000000000000'
const w = (args) => execFileSync('npx', ['wrangler', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })

let id = process.env.D1_DATABASE_ID
if (!id) {
  const list = JSON.parse(w(['d1', 'list', '--json']))
  id = list.find(d => d.name === NAME)?.uuid
}
if (!id) {
  console.log(`D1 データベース "${NAME}" が無いので作成します (初回のみ)`)
  const out = w(['d1', 'create', NAME, '--location', 'apac'])
  id = out.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?.[0]
  if (!id) throw new Error('作成したデータベースの ID を読み取れませんでした:\n' + out)
}
const cfg = readFileSync('wrangler.jsonc', 'utf8')
if (!cfg.includes(PLACEHOLDER)) throw new Error('wrangler.jsonc に仮の ID が見つかりません')
writeFileSync('wrangler.jsonc', cfg.replace(PLACEHOLDER, id))
console.log(`D1: ${NAME} (${id.slice(0, 8)}…)`)
