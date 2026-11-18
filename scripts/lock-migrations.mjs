// 適用済みマイグレーションの改ざん防止。新しいマイグレーションを追加したら `npm run migrations:lock` を実行する。
// 既存ファイルのハッシュが変わっていたら書き込まずにエラーにする (= 本番適用済みのSQLを書き換えない)。
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'

const dir = new URL('../migrations/', import.meta.url)
const lockPath = new URL('checksums.json', dir)
const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, 'utf8')) : {}
const files = readdirSync(dir).filter(f => /^\d{4}_.+\.sql$/.test(f)).sort()
let changed = false
for (const f of files) {
  const h = createHash('sha256').update(readFileSync(new URL(f, dir))).digest('hex')
  if (lock[f] && lock[f] !== h) {
    console.error(`✖ ${f} は既に確定済みなのに内容が変わっています。元に戻し、変更は新しい番号のファイルで行ってください。`)
    process.exit(1)
  }
  if (!lock[f]) {
    lock[f] = h
    changed = true
    console.log(`+ ${f}`)
  }
}
if (changed) writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n')
else console.log('変更なし')
