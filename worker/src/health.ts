import { entity, type EntityDef, type EntityName } from '../../shared/schema.ts'
import { finalize, validate } from '../../shared/validate.ts'
import type { ParsedHealth } from '../../shared/health.ts'
import { auditStmt, columns, type DbRow } from './store.ts'

/**
 * ヘルスケアのデータを取り込む (上書きではなく、空欄を埋める・新しい値で更新するマージ)。
 *
 * - 睡眠・日次の値は「日付 + 入力元 health」で1件。手入力 (web) の行とは別に持つ
 * - 体組成は1日1件 (その日の最後の値)
 * - ワークアウトは開始時刻ごとに1件。手入力の WOD と重なっても消さずに両方残す
 *   (分析では手入力を優先して、負荷を二重に数えない: shared/analytics.ts)
 * - ゴミ箱に入れた行は復活させない
 *
 * 1回のリクエストで書くのは新しい順に MAX_ROWS 件まで (Workers 無料枠の1リクエストあたりのクエリ数上限)。
 */
export const MAX_ROWS = 40

export interface IngestResult {
  format: string
  inserted: number
  updated: number
  unchanged: number
  /** 上限を超えて今回は書かなかった行 (古い日付のもの)。もう一度送れば続きが入る */
  deferred: number
  invalid: { entity: string; date?: unknown; errors: string[] }[]
  ignored: string[]
}

const ORDER: EntityName[] = ['sleep_logs', 'daily_health', 'body_metrics', 'workouts', 'cardio_sessions']

export async function ingestHealth(db: D1Database, parsed: ParsedHealth, actor: string): Promise<IngestResult> {
  const result: IngestResult = { format: parsed.format, inserted: 0, updated: 0, unchanged: 0, deferred: 0, invalid: [], ignored: parsed.ignored }

  // 検証して、新しい日付から順に上限まで
  const items: { name: EntityName; def: EntityDef; values: Record<string, unknown> }[] = []
  for (const name of ORDER) {
    const def = entity(name)!
    for (const row of parsed.rows[name as keyof typeof parsed.rows] ?? []) {
      const v = validate(name, row)
      if (!v.ok) {
        result.invalid.push({ entity: name, date: row.date, errors: v.errors })
        continue
      }
      items.push({ name, def, values: finalize(name, v.values) })
    }
  }
  items.sort((a, b) => String(b.values.date).localeCompare(String(a.values.date)))
  const todo = items.slice(0, MAX_ROWS)
  result.deferred = items.length - todo.length

  // 既存の行をまとめて引く (種類ごとに1クエリ)
  const existing = new Map<string, DbRow>() // key: entity|id または entity|date
  for (const name of ORDER) {
    const list = todo.filter(i => i.name === name)
    if (!list.length) continue
    const def = list[0].def
    const byDate = !!def.uniqueBy
    const keys = byDate ? [...new Set(list.map(i => String(i.values.date)))] : list.map(i => String(i.values.id))
    // ゴミ箱の行も引く (同じ日を作り直さない・同じ id で衝突させないため)。生きている行を優先
    const where = byDate ? `source = 'health' AND date IN (${keys.map(() => '?').join(', ')})` : `id IN (${keys.map(() => '?').join(', ')})`
    const res = await db.prepare(`SELECT ${columns(def).join(', ')} FROM ${def.table} WHERE ${where}`).bind(...keys).all<DbRow>()
    for (const r of res.results) {
      const k = `${name}|${byDate ? r.date : r.id}`
      const prev = existing.get(k)
      if (!prev || (prev.deleted_at && !r.deleted_at)) existing.set(k, r)
    }
  }

  const stmts: D1PreparedStatement[] = []
  const inserted: string[] = []
  const ts = new Date().toISOString()
  for (const it of todo) {
    const key = `${it.name}|${it.def.uniqueBy ? it.values.date : it.values.id}`
    const cur = existing.get(key)
    if (cur?.deleted_at) {
      result.unchanged++ // ゴミ箱に入れたものは戻さない
      continue
    }
    if (cur) {
      const patch: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(it.values)) {
        if (k === 'id' || v == null) continue
        if (cur[k] !== v) patch[k] = v
      }
      if (!Object.keys(patch).length) {
        result.unchanged++
        continue
      }
      const sets = Object.keys(patch)
      stmts.push(db.prepare(`UPDATE ${it.def.table} SET ${sets.map(c => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).bind(...Object.values(patch), ts, cur.id))
      stmts.push(auditStmt(db, actor, 'merge', it.def.table, cur.id, cur, { ...cur, ...patch, updated_at: ts }))
      result.updated++
    } else {
      const values = { ...it.values }
      const id = String(values.id)
      delete values.id
      const cols = ['id', ...Object.keys(values), 'created_at', 'updated_at']
      stmts.push(db.prepare(`INSERT INTO ${it.def.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).bind(id, ...Object.values(values), ts, ts))
      inserted.push(`${it.def.table}:${id}`)
      result.inserted++
    }
  }
  if (inserted.length) stmts.push(auditStmt(db, actor, 'import', 'health', inserted.join(',').slice(0, 2000), null, { inserted: inserted.length }))
  if (stmts.length) await db.batch(stmts)
  return result
}
