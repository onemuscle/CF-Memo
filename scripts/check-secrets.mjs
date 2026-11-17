// 秘密情報・健康データの誤コミット検査。CI と git の pre-commit フックで実行する。
//   node scripts/check-secrets.mjs          リポジトリ内の追跡ファイルすべて
//   node scripts/check-secrets.mjs --staged コミットしようとしているファイルだけ
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'

const staged = process.argv.includes('--staged')
const files = execFileSync('git', staged ? ['diff', '--cached', '--name-only', '--diff-filter=ACM'] : ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)

const FORBIDDEN_FILES = [
  [/(^|\/)\.dev\.vars/, 'ローカル用の秘密情報ファイル'],
  [/(^|\/)\.env(\.|$)(?!example)/, '環境変数ファイル'],
  [/(^|\/)\.cfm\.json$/, 'CLI の接続設定 (トークン入り)'],
  [/\.(sqlite3?|db)$/, 'データベースファイル'],
  [/(^|\/)backups\//, 'バックアップ'],
  [/cf-memo-(backup|legacy)-.*\.json$/, 'バックアップ'],
  [/\.(pem|key|p12)$/, '秘密鍵'],
]

const PATTERNS = [
  [/sk-ant-[A-Za-z0-9_-]{20,}/, 'Anthropic API キー'],
  [/gh[pousr]_[A-Za-z0-9]{30,}/, 'GitHub トークン'],
  [/AKIA[0-9A-Z]{16}/, 'AWS キー'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, '秘密鍵'],
  [/(API_TOKEN|CFM_TOKEN|CLOUDFLARE_API_TOKEN|BACKUP_PASSPHRASE)\s*[=:]\s*["']?[A-Za-z0-9_\-]{24,}/, 'トークンの値'],
  [/"format"\s*:\s*"cf-memo-(platform|legacy)-export"/, 'バックアップファイルの中身'],
]

const SKIP = [/^package-lock\.json$/, /^public\/tessdata\//, /\.(png|jpg|jpeg|gif|webp|gz|ico|woff2?)$/, /^scripts\/check-secrets\.mjs$/]
const problems = []
for (const f of files) {
  for (const [re, why] of FORBIDDEN_FILES) if (re.test(f)) problems.push(`${f}: ${why}はコミットしない`)
  if (SKIP.some(re => re.test(f))) continue
  let text
  try {
    if (statSync(f).size > 2_000_000) continue
    text = readFileSync(f, 'utf8')
  } catch {
    continue
  }
  // バックアップ形式の文字列はプログラム中の定数としては許可 (中身のデータがあるかで判定)
  for (const [re, why] of PATTERNS) {
    const m = text.match(re)
    if (!m) continue
    if (why === 'バックアップファイルの中身' && !/"tables"\s*:\s*\{|"memos"\s*:\s*\[\s*\{/.test(text)) continue
    problems.push(`${f}: ${why}らしき文字列 (${m[0].slice(0, 12)}…)`)
  }
}
if (problems.length) {
  console.error('✖ 秘密情報・個人データの可能性があるものが見つかりました:\n' + problems.map(p => '  - ' + p).join('\n'))
  console.error('意図したものでなければ、ファイルを外してください (git rm --cached <file>)。')
  process.exit(1)
}
console.log(`✔ 秘密情報チェック OK (${files.length} ファイル)`)
