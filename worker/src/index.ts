import { Hono, type Context } from 'hono'
import { ENTITIES, SCHEMA_VERSION, entity, type EntityDef } from '../../shared/schema.ts'
import { authenticate, type Principal } from './auth.ts'
import type { Env } from './env.ts'
import * as store from './store.ts'
import { HttpError } from './store.ts'
import { parseHealthPayload } from '../../shared/health.ts'
import { ingestHealth } from './health.ts'
import { scanWod, ScanError, toWorkoutFields } from './wodscan.ts'
import { exportAll, fromBase64, importChunk, importProfile, IMPORT_CHUNK, type ExportFile } from './transfer.ts'

type App = { Bindings: Env; Variables: { principal: Principal } }

const app = new Hono<App>()

const MAX_ATTACHMENT = 1_800_000

/** 先頭バイトで実際の画像形式を判定する (Content-Type は偽装できるので信用しない) */
function sniffImage(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to))
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  if (ascii(4, 8) === 'ftyp' && /^(heic|heix|hevc|mif1|msf1|heif)$/.test(ascii(8, 12))) return 'image/heic'
  return null
} // D1 の1行の上限 (2MB) に収める
const MAX_JSON_BODY = 2_000_000

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message, details: err.details }, err.status as 400)
  console.error(err)
  return c.json({ error: 'サーバーでエラーが起きました' }, 500)
})

app.use('/api/*', async (c, next) => {
  await next()
  c.header('Cache-Control', 'no-store')
  c.header('X-Content-Type-Options', 'nosniff')
})

// 稼働確認だけは認証なし (中身は返さない)
app.get('/api/health', c => c.json({ ok: true }))

app.use('/api/*', async (c, next) => {
  const p = await authenticate(c.req.raw, c.env)
  if (!p) return c.json({ error: 'ログインが必要です' }, 401)
  // ブラウザ (Cookie 認証) からの書き込みは、自前のヘッダーが付いているものだけ許す (CSRF 対策)
  if (p.kind === 'access' && c.req.method !== 'GET' && c.req.header('X-CFM-Client') !== '1') {
    return c.json({ error: '不正なリクエストです' }, 403)
  }
  c.set('principal', p)
  await next()
})

const actor = (c: Context<App>) => c.get('principal').actor
const defaultSource = (c: Context<App>) => (c.get('principal').kind === 'token' ? 'agent' : 'web')

async function body<T>(c: Context<App>): Promise<T> {
  const len = Number(c.req.header('Content-Length') ?? 0)
  if (len > MAX_JSON_BODY) throw new HttpError(413, 'データが大きすぎます')
  try {
    return await c.req.json<T>()
  } catch {
    throw new HttpError(400, 'JSON として読めません')
  }
}

app.get('/api/me', c => c.json({ ...c.get('principal'), features: { wod_scan: !!c.env.ANTHROPIC_API_KEY } }))

app.get('/api/schema', c => c.json({ version: SCHEMA_VERSION, entities: ENTITIES }))

/** データの健康診断: 件数・スキーマ版・最終更新 */
app.get('/api/meta', async c => {
  const defs = Object.values(ENTITIES) as unknown as EntityDef[]
  const stmts = defs.map(d =>
    c.env.DB.prepare(`SELECT COUNT(*) AS n, SUM(deleted_at IS NOT NULL) AS deleted, MAX(updated_at) AS last FROM ${d.table}`),
  )
  stmts.push(c.env.DB.prepare('SELECT name FROM d1_migrations ORDER BY id'))
  stmts.push(c.env.DB.prepare('SELECT COUNT(*) AS n, MAX(at) AS last FROM audit_log'))
  stmts.push(c.env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS bytes FROM attachments WHERE deleted_at IS NULL'))
  const res = await c.env.DB.batch(stmts)
  const counts: Record<string, unknown> = {}
  defs.forEach((d, i) => (counts[d.name] = res[i].results[0]))
  return c.json({
    schema_version: SCHEMA_VERSION,
    migrations: res[defs.length].results.map(r => (r as { name: string }).name),
    counts,
    audit: res[defs.length + 1].results[0],
    attachments: res[defs.length + 2].results[0],
  })
})

/**
 * 期間内の全記録をまとめて返す (ダッシュボード・分析・Claude Code のコンテキスト用)。
 * 目標・怪我・サプリ・栄養目標・大会予定は期間に関係なく全件返す。
 */
app.get('/api/bundle', async c => {
  const from = c.req.query('from')
  const to = c.req.query('to')
  if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new HttpError(400, 'from は YYYY-MM-DD')
  if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new HttpError(400, 'to は YYYY-MM-DD')
  const always = new Set(['goals', 'injuries', 'supplements', 'nutrition_targets', 'races'])
  const names = Object.keys(ENTITIES).filter(n => n !== 'reports' || c.req.query('reports') === '1')
  const rows = await Promise.all(
    names.map(n => store.list(c.env.DB, n, always.has(n) ? { limit: 5000 } : { from, to, limit: 5000 })),
  )
  const profile = await c.env.DB.prepare('SELECT key, value FROM profile').all<{ key: string; value: string }>()
  const data: Record<string, unknown> = {}
  names.forEach((n, i) => (data[n] = rows[i]))
  return c.json({
    from: from ?? null,
    to: to ?? null,
    profile: Object.fromEntries(profile.results.map(r => [r.key, safeParse(r.value)])),
    data,
  })
})

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
}

// ---- 記録の CRUD ----

app.get('/api/e/:entity', async c => {
  const q = c.req.query()
  const d = entity(c.req.param('entity'))
  const where: Record<string, string> = {}
  for (const f of d?.fields ?? []) if (q[f.name] !== undefined) where[f.name] = q[f.name]
  const rows = await store.list(c.env.DB, c.req.param('entity'), {
    from: q.from,
    to: q.to,
    limit: q.limit ? Number(q.limit) : undefined,
    offset: q.offset ? Number(q.offset) : undefined,
    includeDeleted: q.include_deleted === '1',
    onlyDeleted: q.deleted === '1',
    where,
  })
  return c.json({ rows })
})

app.post('/api/e/:entity', async c => {
  const input = await body<Record<string, unknown>>(c)
  const r = await store.create(c.env.DB, c.req.param('entity'), input, actor(c), defaultSource(c))
  return c.json(r, r.status === 'created' ? 201 : 200)
})

app.get('/api/e/:entity/:id', async c => {
  const row = await store.get(c.env.DB, c.req.param('entity'), c.req.param('id'))
  if (!row) throw new HttpError(404, '記録が見つかりません')
  return c.json({ row })
})

app.patch('/api/e/:entity/:id', async c => {
  const row = await store.update(c.env.DB, c.req.param('entity'), c.req.param('id'), await body(c), actor(c))
  return c.json({ row })
})

app.delete('/api/e/:entity/:id', async c => {
  await store.softDelete(c.env.DB, c.req.param('entity'), c.req.param('id'), actor(c))
  return c.json({ ok: true })
})

app.post('/api/e/:entity/:id/restore', async c => {
  const row = await store.restore(c.env.DB, c.req.param('entity'), c.req.param('id'), actor(c))
  return c.json({ row })
})

/** 複数の記録を一度に追加 (Claude Code の「今日の報告」など)。全部成功か全部失敗のどちらか */
app.post('/api/batch', async c => {
  const { items } = await body<{ items: { entity: string; data: Record<string, unknown> }[] }>(c)
  if (!Array.isArray(items) || items.length === 0 || items.length > IMPORT_CHUNK) {
    throw new HttpError(400, `items は 1〜${IMPORT_CHUNK} 件の配列にしてください`)
  }
  const stmts: D1PreparedStatement[] = []
  const results: (store.WriteResult & { entity: string })[] = []
  const errors: { index: number; entity: string; error: string; details?: unknown }[] = []
  for (const [i, it] of items.entries()) {
    try {
      const r = await store.prepareCreate(c.env.DB, it.entity, it.data ?? {}, actor(c), defaultSource(c))
      stmts.push(...r.stmts)
      results.push({ entity: it.entity, ...r.result })
    } catch (e) {
      errors.push({ index: i, entity: it.entity, error: (e as Error).message, details: (e as HttpError).details })
    }
  }
  if (errors.length) return c.json({ error: '一部の入力に誤りがあるため、何も保存していません', errors }, 422)
  if (stmts.length) await c.env.DB.batch(stmts)
  return c.json({ results }, 201)
})

// ---- プロフィール (key-value) ----

app.get('/api/profile', async c => {
  const res = await c.env.DB.prepare('SELECT key, value, updated_at FROM profile ORDER BY key').all<{ key: string; value: string; updated_at: string }>()
  return c.json({ profile: Object.fromEntries(res.results.map(r => [r.key, safeParse(r.value)])), rows: res.results })
})

app.put('/api/profile/:key', async c => {
  const key = c.req.param('key')
  if (!/^[a-z0-9_.-]{1,64}$/.test(key)) throw new HttpError(400, 'key は英小文字・数字・_.- の64文字以内')
  const { value } = await body<{ value: unknown }>(c)
  const json = JSON.stringify(value ?? null)
  if (json.length > 50000) throw new HttpError(413, '長すぎます')
  const cur = await c.env.DB.prepare('SELECT key, value, updated_at FROM profile WHERE key = ?').bind(key).first()
  const ts = new Date().toISOString()
  await c.env.DB.batch([
    c.env.DB
      .prepare('INSERT INTO profile (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
      .bind(key, json, ts),
    store.auditStmt(c.env.DB, actor(c), cur ? 'update' : 'create', 'profile', key, cur, { key, value: json, updated_at: ts }),
  ])
  return c.json({ ok: true })
})

// ---- 写真 ----

app.post('/api/attachments', async c => {
  const buf = await c.req.arrayBuffer()
  if (buf.byteLength === 0 || buf.byteLength > MAX_ATTACHMENT) throw new HttpError(413, '画像は1.8MB以下にしてください')
  const mime = sniffImage(new Uint8Array(buf))
  if (!mime) throw new HttpError(415, '画像 (JPEG/PNG/WebP/HEIC) だけ保存できます')
  const id = c.req.query('id') && /^[A-Za-z0-9_-]{1,64}$/.test(c.req.query('id')!) ? c.req.query('id')! : crypto.randomUUID()
  const exists = await c.env.DB.prepare('SELECT id FROM attachments WHERE id = ?').bind(id).first()
  if (exists) return c.json({ id, status: 'unchanged' })
  await c.env.DB.batch([
    c.env.DB
      .prepare('INSERT INTO attachments (id, mime, size, data, caption, source) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, mime, buf.byteLength, buf, c.req.query('caption') ?? null, defaultSource(c)),
    store.auditStmt(c.env.DB, actor(c), 'create', 'attachments', id, null, { mime, size: buf.byteLength }),
  ])
  return c.json({ id, status: 'created' }, 201)
})

app.get('/api/attachments/:id', async c => {
  const row = await c.env.DB.prepare('SELECT mime, data FROM attachments WHERE id = ?').bind(c.req.param('id')).first<{ mime: string; data: ArrayBuffer | number[] }>()
  if (!row) throw new HttpError(404, '画像が見つかりません')
  const bytes = row.data instanceof ArrayBuffer ? row.data : Uint8Array.from(row.data)
  return new Response(bytes, { headers: { 'Content-Type': row.mime, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' } })
})

app.delete('/api/attachments/:id', async c => {
  const ts = new Date().toISOString()
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE attachments SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL').bind(ts, ts, c.req.param('id')),
    store.auditStmt(c.env.DB, actor(c), 'delete', 'attachments', c.req.param('id'), null, { deleted_at: ts }),
  ])
  return c.json({ ok: true })
})

// ---- WOD 写真の読み取り ----

app.post('/api/wod/scan', async c => {
  const { attachment_id } = await body<{ attachment_id?: string }>(c)
  if (!attachment_id) throw new HttpError(400, 'attachment_id が必要です')
  if (!c.env.ANTHROPIC_API_KEY) throw new HttpError(503, '写真の読み取りが未設定です (GitHub Secrets に ANTHROPIC_API_KEY を登録して再デプロイ)')
  const row = await c.env.DB.prepare('SELECT mime, data FROM attachments WHERE id = ? AND deleted_at IS NULL').bind(attachment_id).first<{ mime: string; data: ArrayBuffer | number[] }>()
  if (!row) throw new HttpError(404, '画像が見つかりません')
  const bytes = row.data instanceof ArrayBuffer ? new Uint8Array(row.data) : Uint8Array.from(row.data)
  try {
    const wod = await scanWod(c.env.ANTHROPIC_API_KEY, bytes, row.mime)
    return c.json({ wod, fields: { ...toWorkoutFields(wod), attachment_id } })
  } catch (e) {
    if (e instanceof ScanError) throw new HttpError(e.status, e.message)
    throw e
  }
})

// ---- Apple ヘルスケア (Apple Watch・体重計) の取り込み ----

app.post('/api/ingest/health', async c => {
  const parsed = parseHealthPayload(await body<unknown>(c))
  const r = await ingestHealth(c.env.DB, parsed, c.get('principal').kind === 'token' ? 'health' : actor(c))
  return c.json(r, r.invalid.length && !r.inserted && !r.updated ? 422 : 200)
})

// ---- 変更履歴 ----

app.get('/api/audit', async c => {
  const cond: string[] = []
  const args: unknown[] = []
  const table = c.req.query('table')
  const rowId = c.req.query('row_id')
  if (table) {
    cond.push('table_name = ?')
    args.push(table)
  }
  if (rowId) {
    cond.push('row_id = ?')
    args.push(rowId)
  }
  const limit = Math.min(Number(c.req.query('limit') ?? 100) || 100, 1000)
  const res = await c.env.DB
    .prepare(`SELECT * FROM audit_log${cond.length ? ' WHERE ' + cond.join(' AND ') : ''} ORDER BY seq DESC LIMIT ?`)
    .bind(...args, limit)
    .all()
  return c.json({ rows: res.results })
})

app.post('/api/audit/:seq/revert', async c => {
  const seq = Number(c.req.param('seq'))
  if (!Number.isInteger(seq)) throw new HttpError(400, 'seq が不正です')
  return c.json({ row: await store.revert(c.env.DB, seq, actor(c)) })
})

// ---- バックアップ (書き出し / 取り込み) ----

app.get('/api/export', async c => {
  const file = await exportAll(c.env.DB, {
    attachments: c.req.query('attachments') !== '0',
    audit: c.req.query('audit') !== '0',
  })
  const name = `cf-memo-backup-${file.exported_at.slice(0, 10)}.json`
  return new Response(JSON.stringify(file), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  })
})

app.post('/api/import/chunk', async c => {
  return c.json(await importChunk(c.env.DB, await body(c), actor(c)))
})

app.post('/api/import/profile', async c => {
  const { rows } = await body<{ rows: ExportFile['profile'] }>(c)
  if (!Array.isArray(rows)) throw new HttpError(400, 'rows が必要です')
  return c.json({ updated: await importProfile(c.env.DB, rows, actor(c)) })
})

app.post('/api/import/attachment', async c => {
  const a = await body<NonNullable<ExportFile['attachments']>[number]>(c)
  if (typeof a.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(a.id) || typeof a.data_base64 !== 'string') throw new HttpError(400, '形式が正しくありません')
  const exists = await c.env.DB.prepare('SELECT id FROM attachments WHERE id = ?').bind(a.id).first()
  if (exists) return c.json({ status: 'skipped' })
  const bytes = fromBase64(a.data_base64)
  if (bytes.byteLength > MAX_ATTACHMENT) throw new HttpError(413, '画像が大きすぎます')
  const mime = sniffImage(bytes)
  if (!mime) throw new HttpError(415, '画像だけ取り込めます')
  const ts = new Date().toISOString()
  await c.env.DB.batch([
    c.env.DB
      .prepare('INSERT INTO attachments (id, mime, size, data, caption, source, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(a.id, mime, bytes.byteLength, bytes.buffer, a.caption ?? null, a.source ?? 'import', a.created_at ?? ts, a.updated_at ?? ts, a.deleted_at ?? null),
    store.auditStmt(c.env.DB, actor(c), 'import', 'attachments', a.id, null, { mime, size: bytes.byteLength }),
  ])
  return c.json({ status: 'inserted' })
})

app.all('/api/*', c => c.json({ error: 'API が見つかりません' }, 404))

// API 以外は静的ファイル (Web アプリ本体)
app.all('*', c => c.env.ASSETS.fetch(c.req.raw))

export default app
