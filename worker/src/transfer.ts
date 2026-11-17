import { ENTITIES, SCHEMA_VERSION, type EntityDef } from '../../shared/schema.ts'
import { finalize, validate } from '../../shared/validate.ts'
import { auditStmt, columns, HttpError, type DbRow } from './store.ts'

/**
 * 全データの書き出しと取り込み。
 *
 * 書き出し: 削除済みの行・変更履歴・写真も含めた完全なコピー (JSON)。
 * 取り込み: 「マージ」だけを行う。既存の行は消さない。
 *   - id が無い行 → 追加
 *   - id が同じで、取り込む側の updated_at が新しい → 上書き (変更前の値は audit_log に残る)
 *   - それ以外 → そのまま (スキップ)
 */

export const EXPORT_FORMAT = 'cf-memo-platform-export'

export interface ExportFile {
  format: typeof EXPORT_FORMAT
  schema_version: number
  exported_at: string
  tables: Record<string, DbRow[]>
  profile: { key: string; value: string; updated_at: string }[]
  attachments?: { id: string; mime: string; size: number; data_base64: string; caption: string | null; source: string | null; created_at: string; updated_at: string; deleted_at: string | null }[]
  audit_log?: Record<string, unknown>[]
}

export async function exportAll(db: D1Database, opts: { attachments: boolean; audit: boolean }): Promise<ExportFile> {
  const defs = Object.values(ENTITIES) as unknown as EntityDef[]
  const stmts = defs.map(d => db.prepare(`SELECT ${columns(d).join(', ')} FROM ${d.table} ORDER BY created_at`))
  stmts.push(db.prepare('SELECT key, value, updated_at FROM profile ORDER BY key'))
  const results = await db.batch(stmts)
  const tables: Record<string, DbRow[]> = {}
  defs.forEach((d, i) => (tables[d.name] = results[i].results as DbRow[]))
  const out: ExportFile = {
    format: EXPORT_FORMAT,
    schema_version: SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    tables,
    profile: results[defs.length].results as ExportFile['profile'],
  }
  if (opts.attachments) {
    const res = await db.prepare('SELECT * FROM attachments ORDER BY created_at').all<Record<string, unknown>>()
    out.attachments = res.results.map(r => ({
      id: r.id as string,
      mime: r.mime as string,
      size: r.size as number,
      data_base64: toBase64(r.data),
      caption: (r.caption as string) ?? null,
      source: (r.source as string) ?? null,
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      deleted_at: (r.deleted_at as string) ?? null,
    }))
  }
  if (opts.audit) {
    out.audit_log = (await db.prepare('SELECT * FROM audit_log ORDER BY seq').all()).results
  }
  return out
}

function toBase64(data: unknown): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : Array.isArray(data) ? Uint8Array.from(data as number[]) : (data as Uint8Array)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

/** 1回のリクエストで取り込む行数の上限 (Workers の1リクエストあたりのクエリ数制限に収めるため) */
export const IMPORT_CHUNK = 20

export interface ImportChunk {
  entity: string
  rows: Record<string, unknown>[]
  dry_run?: boolean
}

export interface ImportResult {
  inserted: number
  updated: number
  skipped: number
  errors: { id?: string; errors: string[] }[]
}

export async function importChunk(db: D1Database, chunk: ImportChunk, actor: string): Promise<ImportResult> {
  const d = (ENTITIES as unknown as Record<string, EntityDef>)[chunk.entity]
  if (!d) throw new HttpError(400, `不明な記録の種類: ${chunk.entity}`)
  if (!Array.isArray(chunk.rows) || chunk.rows.length > IMPORT_CHUNK) {
    throw new HttpError(400, `rows は ${IMPORT_CHUNK} 件以内の配列にしてください`)
  }
  const result: ImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] }
  const prepared: { id: string; values: Record<string, unknown> }[] = []
  for (const raw of chunk.rows) {
    // 計算列は取り込まずに作り直す
    const input: Record<string, unknown> = {}
    const computed = new Set(d.fields.filter(f => f.computed).map(f => f.name))
    for (const [k, v] of Object.entries(raw)) if (!computed.has(k)) input[k] = v
    const v = validate(d.name as never, input, { allowMeta: true })
    if (!v.ok || typeof v.values.id !== 'string') {
      result.errors.push({ id: raw.id as string | undefined, errors: v.ok ? ['id がありません'] : v.errors })
      continue
    }
    prepared.push({ id: v.values.id, values: finalize(d.name as never, v.values) })
  }
  if (!prepared.length) return result

  const ids = prepared.map(p => p.id)
  const existing = await db
    .prepare(`SELECT ${columns(d).join(', ')} FROM ${d.table} WHERE id IN (${ids.map(() => '?').join(', ')})`)
    .bind(...ids)
    .all<DbRow>()
  const byId = new Map(existing.results.map(r => [r.id, r]))

  const stmts: D1PreparedStatement[] = []
  const insertedIds: string[] = []
  const ts = new Date().toISOString()
  for (const p of prepared) {
    const cur = byId.get(p.id)
    const values = { ...p.values }
    values.created_at ??= ts
    values.updated_at ??= ts
    if ('deleted_at' in values === false) values.deleted_at = null
    if (!cur) {
      const cols = Object.keys(values)
      stmts.push(db.prepare(`INSERT INTO ${d.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).bind(...Object.values(values)))
      insertedIds.push(p.id)
      result.inserted++
    } else if (String(values.updated_at) > String(cur.updated_at)) {
      const { id: _id, created_at: _c, ...rest } = values
      const cols = Object.keys(rest)
      stmts.push(db.prepare(`UPDATE ${d.table} SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`).bind(...Object.values(rest), p.id))
      stmts.push(auditStmt(db, actor, 'import', d.table, p.id, cur, { ...cur, ...rest }))
      result.updated++
    } else {
      result.skipped++
    }
  }
  if (insertedIds.length) {
    stmts.push(auditStmt(db, actor, 'import', d.table, insertedIds.join(','), null, { inserted: insertedIds.length }))
  }
  if (!chunk.dry_run && stmts.length) await db.batch(stmts)
  return result
}

export async function importProfile(db: D1Database, rows: ExportFile['profile'], actor: string): Promise<number> {
  let n = 0
  const stmts: D1PreparedStatement[] = []
  for (const r of rows.slice(0, IMPORT_CHUNK)) {
    if (typeof r.key !== 'string' || typeof r.value !== 'string') continue
    const cur = await db.prepare('SELECT value, updated_at FROM profile WHERE key = ?').bind(r.key).first<{ value: string; updated_at: string }>()
    if (cur && cur.updated_at >= (r.updated_at ?? '')) continue
    stmts.push(
      db
        .prepare('INSERT INTO profile (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
        .bind(r.key, r.value, r.updated_at ?? new Date().toISOString()),
    )
    stmts.push(auditStmt(db, actor, 'import', 'profile', r.key, cur, r))
    n++
  }
  if (stmts.length) await db.batch(stmts)
  return n
}
