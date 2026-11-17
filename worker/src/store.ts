import { ENTITIES, entity, type EntityDef, type EntityName } from '../../shared/schema.ts'
import { finalize, validate } from '../../shared/validate.ts'

/**
 * 記録の読み書き。SQL に入る列名はすべて shared/schema.ts の定義から取るので、
 * 利用者の入力が列名として SQL に混ざることはない (値は必ずプレースホルダで渡す)。
 *
 * 書き込みは必ず audit_log とセットで batch (= 1つのトランザクション) にする。
 */

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message)
  }
}

export type DbRow = Record<string, unknown> & { id: string; updated_at: string; deleted_at: string | null }

export function def(name: string): EntityDef & { name: EntityName } {
  const d = entity(name)
  if (!d) throw new HttpError(404, `不明な記録の種類: ${name}`)
  return d as EntityDef & { name: EntityName }
}

function columns(d: EntityDef): string[] {
  return ['id', ...d.fields.map(f => f.name), 'created_at', 'updated_at', 'deleted_at']
}

const now = () => new Date().toISOString()

export function auditStmt(
  db: D1Database,
  actor: string,
  action: string,
  table: string,
  rowId: string,
  before: unknown,
  after: unknown,
): D1PreparedStatement {
  return db
    .prepare('INSERT INTO audit_log (actor, action, table_name, row_id, before, after) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(actor, action, table, rowId, before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after))
}

export interface ListQuery {
  from?: string
  to?: string
  limit?: number
  offset?: number
  includeDeleted?: boolean
  onlyDeleted?: boolean
  /** 列 = 値 の絞り込み (定義にある列だけ) */
  where?: Record<string, string>
}

export async function list(db: D1Database, name: string, q: ListQuery = {}): Promise<DbRow[]> {
  const d = def(name)
  const cond: string[] = []
  const args: unknown[] = []
  if (q.onlyDeleted) cond.push('deleted_at IS NOT NULL')
  else if (!q.includeDeleted) cond.push('deleted_at IS NULL')
  if (d.dateField && q.from) {
    cond.push(`${d.dateField} >= ?`)
    args.push(q.from)
  }
  if (d.dateField && q.to) {
    cond.push(`${d.dateField} <= ?`)
    args.push(q.to)
  }
  const fieldNames = new Set(d.fields.map(f => f.name))
  for (const [k, v] of Object.entries(q.where ?? {})) {
    if (!fieldNames.has(k)) throw new HttpError(400, `${k} では絞り込めません`)
    cond.push(`${k} = ?`)
    args.push(v)
  }
  const order = d.dateField ? `${d.dateField} DESC, created_at DESC` : 'created_at DESC'
  const limit = Math.min(Math.max(q.limit ?? 500, 1), 5000)
  const sql = `SELECT ${columns(d).join(', ')} FROM ${d.table}${cond.length ? ' WHERE ' + cond.join(' AND ') : ''} ORDER BY ${order} LIMIT ? OFFSET ?`
  const res = await db
    .prepare(sql)
    .bind(...args, limit, Math.max(q.offset ?? 0, 0))
    .all<DbRow>()
  return res.results
}

export async function get(db: D1Database, name: string, id: string): Promise<DbRow | null> {
  const d = def(name)
  return db.prepare(`SELECT ${columns(d).join(', ')} FROM ${d.table} WHERE id = ?`).bind(id).first<DbRow>()
}

/** uniqueBy (例: 1日1件のコンディション) に当たる既存行を探す */
async function findUnique(db: D1Database, d: EntityDef, values: Record<string, unknown>): Promise<DbRow | null> {
  if (!d.uniqueBy) return null
  const cond = d.uniqueBy.map(c => (c === 'source' ? "COALESCE(source, '') = COALESCE(?, '')" : `${c} = ?`))
  const args = d.uniqueBy.map(c => values[c] ?? null)
  return db
    .prepare(`SELECT ${columns(d).join(', ')} FROM ${d.table} WHERE ${cond.join(' AND ')} AND deleted_at IS NULL LIMIT 1`)
    .bind(...args)
    .first<DbRow>()
}

export interface WriteResult {
  row: DbRow
  /** created=新規 / merged=同じ日の既存行に上書き / unchanged=同じ id で同じ内容が既にあった */
  status: 'created' | 'merged' | 'unchanged'
}

/** 新規作成の準備 (SQL文を返すだけで、実行は呼び出し側でまとめて batch する) */
export async function prepareCreate(
  db: D1Database,
  name: string,
  input: Record<string, unknown>,
  actor: string,
  defaultSource: string,
): Promise<{ stmts: D1PreparedStatement[]; result: WriteResult }> {
  const d = def(name)
  const v = validate(d.name, input)
  if (!v.ok) throw new HttpError(422, '入力内容を確認してください', v.errors)
  if (v.values.source == null) v.values.source = defaultSource

  if (typeof v.values.id === 'string') {
    const existing = await get(db, name, v.values.id)
    if (existing) {
      // 同じ id の再送 (通信の再試行など) は二重登録しない
      return { stmts: [], result: { row: existing, status: 'unchanged' } }
    }
  }

  const dup = await findUnique(db, d, v.values)
  if (dup) {
    const { id: _ignored, ...patch } = v.values
    const merged = finalize(d.name, { ...pick(dup, d), ...nonNull(patch) })
    return prepareUpdateRow(db, d, dup, merged, actor, 'merge')
  }

  const id = (v.values.id as string | undefined) ?? crypto.randomUUID()
  const ts = now()
  const values = finalize(d.name, { ...v.values })
  delete values.id
  const cols = ['id', ...Object.keys(values), 'created_at', 'updated_at']
  const row = { id, ...values, created_at: ts, updated_at: ts, deleted_at: null } as DbRow
  const stmt = db
    .prepare(`INSERT INTO ${d.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .bind(id, ...Object.values(values), ts, ts)
  return { stmts: [stmt, auditStmt(db, actor, 'create', d.table, id, null, row)], result: { row, status: 'created' } }
}

export async function create(
  db: D1Database,
  name: string,
  input: Record<string, unknown>,
  actor: string,
  defaultSource: string,
): Promise<WriteResult> {
  const { stmts, result } = await prepareCreate(db, name, input, actor, defaultSource)
  if (stmts.length) await db.batch(stmts)
  return result
}

function pick(row: DbRow, d: EntityDef): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of d.fields) if (!f.computed) out[f.name] = row[f.name]
  return out
}

function nonNull(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v != null))
}

function prepareUpdateRow(
  db: D1Database,
  d: EntityDef,
  before: DbRow,
  values: Record<string, unknown>,
  actor: string,
  action: string,
): { stmts: D1PreparedStatement[]; result: WriteResult } {
  const ts = now()
  const sets = Object.keys(values)
  const stmt = db
    .prepare(`UPDATE ${d.table} SET ${sets.map(c => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`)
    .bind(...Object.values(values), ts, before.id)
  const after = { ...before, ...values, updated_at: ts } as DbRow
  return {
    stmts: [stmt, auditStmt(db, actor, action, d.table, before.id, before, after)],
    result: { row: after, status: 'merged' },
  }
}

export async function update(db: D1Database, name: string, id: string, patch: Record<string, unknown>, actor: string): Promise<DbRow> {
  const d = def(name)
  const before = await get(db, name, id)
  if (!before) throw new HttpError(404, '記録が見つかりません')
  const { id: _i, ...rest } = patch
  const v = validate(d.name, rest, { partial: true })
  if (!v.ok) throw new HttpError(422, '入力内容を確認してください', v.errors)
  const merged = finalize(d.name, { ...pick(before, d), ...v.values })
  for (const f of d.fields) {
    if (f.required && (merged[f.name] == null || merged[f.name] === '')) throw new HttpError(422, `${f.label} は必須です`)
  }
  const { stmts, result } = prepareUpdateRow(db, d, before, merged, actor, 'update')
  await db.batch(stmts)
  return result.row
}

/** 論理削除。行は残り、ゴミ箱から戻せる */
export async function softDelete(db: D1Database, name: string, id: string, actor: string): Promise<void> {
  const d = def(name)
  const before = await get(db, name, id)
  if (!before) throw new HttpError(404, '記録が見つかりません')
  if (before.deleted_at) return
  const ts = now()
  await db.batch([
    db.prepare(`UPDATE ${d.table} SET deleted_at = ?, updated_at = ? WHERE id = ?`).bind(ts, ts, id),
    auditStmt(db, actor, 'delete', d.table, id, before, { ...before, deleted_at: ts, updated_at: ts }),
  ])
}

export async function restore(db: D1Database, name: string, id: string, actor: string): Promise<DbRow> {
  const d = def(name)
  const before = await get(db, name, id)
  if (!before) throw new HttpError(404, '記録が見つかりません')
  if (!before.deleted_at) return before
  if (d.uniqueBy) {
    const live = await findUnique(db, d, before)
    if (live) throw new HttpError(409, '同じ日付の記録が別にあるため戻せません。先にそちらを削除してください')
  }
  const ts = now()
  const after = { ...before, deleted_at: null, updated_at: ts }
  await db.batch([
    db.prepare(`UPDATE ${d.table} SET deleted_at = NULL, updated_at = ? WHERE id = ?`).bind(ts, id),
    auditStmt(db, actor, 'restore', d.table, id, before, after),
  ])
  return after
}

/** 監査ログの1件を取り消す (その変更の直前の状態に戻す) */
export async function revert(db: D1Database, seq: number, actor: string): Promise<DbRow> {
  const log = await db.prepare('SELECT * FROM audit_log WHERE seq = ?').bind(seq).first<{
    table_name: string
    row_id: string
    action: string
    before: string | null
  }>()
  if (!log) throw new HttpError(404, '履歴が見つかりません')
  const d = Object.values(ENTITIES).find(e => e.table === log.table_name) as EntityDef | undefined
  if (!d) throw new HttpError(400, 'この履歴は取り消せません')
  const current = await get(db, d.name, log.row_id)
  if (!current) throw new HttpError(404, '記録が見つかりません')
  const ts = now()
  if (log.action === 'create') {
    // 作成の取り消し = 論理削除
    await softDelete(db, d.name, log.row_id, actor)
    return { ...current, deleted_at: ts }
  }
  if (!log.before) throw new HttpError(400, 'この履歴には変更前の値がありません')
  const before = JSON.parse(log.before) as DbRow
  const values: Record<string, unknown> = {}
  for (const c of columns(d)) if (c !== 'id' && c !== 'created_at' && c !== 'updated_at') values[c] = before[c] ?? null
  const sets = Object.keys(values)
  await db.batch([
    db
      .prepare(`UPDATE ${d.table} SET ${sets.map(c => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`)
      .bind(...Object.values(values), ts, log.row_id),
    auditStmt(db, actor, `revert#${seq}`, d.table, log.row_id, current, { ...current, ...values, updated_at: ts }),
  ])
  return { ...current, ...values, updated_at: ts } as DbRow
}

export { columns }
