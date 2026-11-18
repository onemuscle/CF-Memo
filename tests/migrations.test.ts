import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { ENTITIES, SCHEMA_VERSION, type EntityDef } from '../shared/schema.ts'

const dir = new URL('../migrations/', import.meta.url)
const files = readdirSync(dir).filter(f => /^\d{4}_.+\.sql$/.test(f)).sort()
const sqlOf = (f: string) => readFileSync(new URL(f, dir), 'utf8')

test('マイグレーションを順に適用でき、schema.ts の全項目が列として存在する', () => {
  const db = new DatabaseSync(':memory:')
  for (const f of files) db.exec(sqlOf(f))
  for (const d of Object.values(ENTITIES) as unknown as EntityDef[]) {
    const cols = new Set((db.prepare(`PRAGMA table_info(${d.table})`).all() as { name: string }[]).map(c => c.name))
    for (const c of ['id', 'created_at', 'updated_at', 'deleted_at', ...d.fields.map(f => f.name)]) {
      assert.ok(cols.has(c), `${d.table}.${c} がマイグレーションにありません`)
    }
  }
})

test('SCHEMA_VERSION は最新のマイグレーション番号と一致する', () => {
  assert.equal(SCHEMA_VERSION, Number(files[files.length - 1].slice(0, 4)))
})

test('確定済みのマイグレーションは書き換えられていない', () => {
  const lock = JSON.parse(readFileSync(new URL('checksums.json', dir), 'utf8')) as Record<string, string>
  for (const f of files) {
    const h = createHash('sha256').update(sqlOf(f)).digest('hex')
    assert.ok(lock[f], `${f} が checksums.json に未登録です (npm run migrations:lock)`)
    assert.equal(h, lock[f], `${f} の内容が確定後に変わっています`)
  }
})

test('2本目以降のマイグレーションにデータを消す操作が無い', () => {
  for (const f of files.slice(1)) {
    const sql = sqlOf(f).replace(/--.*$/gm, '')
    assert.ok(!/\bDROP\s+(TABLE|COLUMN)\b/i.test(sql), `${f}: DROP は禁止`)
    assert.ok(!/\bRENAME\b/i.test(sql), `${f}: RENAME は禁止`)
    assert.ok(!/\bDELETE\s+FROM\b/i.test(sql), `${f}: DELETE FROM は禁止`)
    assert.ok(!/\bTRUNCATE\b/i.test(sql), `${f}: TRUNCATE は禁止`)
  }
})

test('既存データが入った状態でも後続のマイグレーションが通る', () => {
  const db = new DatabaseSync(':memory:')
  db.exec(sqlOf(files[0]))
  db.exec("INSERT INTO strength_sets (id, date, movement, weight_kg, reps) VALUES ('keep-me', '2026-11-17', 'Back Squat', 120, 5)")
  for (const f of files.slice(1)) db.exec(sqlOf(f))
  const row = db.prepare("SELECT weight_kg FROM strength_sets WHERE id = 'keep-me'").get() as { weight_kg: number }
  assert.equal(row.weight_kg, 120)
})
