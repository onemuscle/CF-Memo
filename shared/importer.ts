/**
 * バックアップファイルの取り込み手順 (Webアプリ・CLI 共通)。
 * サーバーの1リクエストあたりの上限に合わせて20行ずつ送る。既存データは消さない (マージのみ)。
 */

export interface ImportPayload {
  tables: Record<string, Record<string, unknown>[]>
  profile?: { key: string; value: string; updated_at: string }[]
  attachments?: { id: string; mime: string; data_base64: string; [k: string]: unknown }[]
}

export interface ImportTotals {
  inserted: number
  updated: number
  skipped: number
  attachments: number
  profile: number
  errors: string[]
}

export type Post = <T>(path: string, body: unknown) => Promise<T>

const CHUNK = 20

export function countRows(p: ImportPayload): number {
  return Object.values(p.tables).reduce((a, r) => a + r.length, 0) + (p.attachments?.length ?? 0) + (p.profile?.length ?? 0)
}

export async function runImport(p: ImportPayload, post: Post, opts: { dryRun?: boolean; onProgress?: (done: number, total: number) => void } = {}): Promise<ImportTotals> {
  const t: ImportTotals = { inserted: 0, updated: 0, skipped: 0, attachments: 0, profile: 0, errors: [] }
  const total = countRows(p)
  let done = 0
  const tick = (k: number) => {
    done += k
    opts.onProgress?.(done, total)
  }
  if (!opts.dryRun) {
    for (const a of p.attachments ?? []) {
      try {
        const r = await post<{ status: string }>('/api/import/attachment', a)
        if (r.status === 'inserted') t.attachments++
      } catch (e) {
        t.errors.push(`写真 ${a.id}: ${(e as Error).message}`)
      }
      tick(1)
    }
  }
  for (const [entity, rows] of Object.entries(p.tables)) {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK)
      try {
        const r = await post<{ inserted: number; updated: number; skipped: number; errors: { id?: string; errors: string[] }[] }>('/api/import/chunk', {
          entity,
          rows: slice,
          dry_run: !!opts.dryRun,
        })
        t.inserted += r.inserted
        t.updated += r.updated
        t.skipped += r.skipped
        for (const e of r.errors) t.errors.push(`${entity} ${e.id ?? ''}: ${e.errors.join(' / ')}`)
      } catch (e) {
        t.errors.push(`${entity} ${i + 1}〜${i + slice.length}行目: ${(e as Error).message}`)
      }
      tick(slice.length)
    }
  }
  if (!opts.dryRun && p.profile?.length) {
    for (let i = 0; i < p.profile.length; i += CHUNK) {
      const r = await post<{ updated: number }>('/api/import/profile', { rows: p.profile.slice(i, i + CHUNK) })
      t.profile += r.updated
      tick(Math.min(CHUNK, p.profile.length - i))
    }
  }
  return t
}
