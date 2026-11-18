/**
 * サーバー (Cloudflare Worker) との通信。
 *
 * 電波の悪いジムでも記録を落とさないように、書き込みが通信エラーで失敗したら
 * 端末内の「送信待ち」(outbox) に入れ、つながったときに再送する。
 * 送信前に id を端末側で決めておくので、再送しても二重登録にならない。
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message)
  }
}

async function request<T>(method: string, path: string, body?: unknown, raw?: BodyInit, contentType?: string): Promise<T> {
  const headers: Record<string, string> = { 'X-CFM-Client': '1' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (contentType) headers['Content-Type'] = contentType
  const res = await fetch(path, {
    method,
    headers,
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
    credentials: 'same-origin',
  })
  if (res.status === 401) throw new ApiError(401, 'ログインの有効期限が切れました。ページを再読み込みしてください')
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // Cloudflare Access のログイン画面 (HTML) が返ってきた = セッション切れ
    throw new ApiError(res.status, 'サーバーの応答を読めませんでした。ページを再読み込みしてください')
  }
  if (!res.ok) {
    const j = json as { error?: string; details?: unknown }
    throw new ApiError(res.status, j?.error ?? `エラー (${res.status})`, j?.details)
  }
  return json as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, blob: Blob) => request<T>('POST', path, undefined, blob, blob.type || 'image/jpeg'),
}

export type Row = Record<string, unknown> & { id: string; created_at?: string; updated_at?: string; deleted_at?: string | null }

// ---- 送信待ち (オフライン対応) ----

const OUTBOX_KEY = 'cfm-outbox-v1'

interface Pending {
  entity: string
  data: Record<string, unknown>
  queuedAt: string
}

function readOutbox(): Pending[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]') as Pending[]
  } catch {
    return []
  }
}
function writeOutbox(list: Pending[]) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(list))
  } catch {
    // 保存できない環境 (プライベートモード等) では送信待ちを持てない
  }
  window.dispatchEvent(new Event('cfm-outbox'))
}

export function outboxCount(): number {
  return readOutbox().length
}

function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError || (e instanceof ApiError && e.status >= 500)
}

/** 記録を保存。通信できなければ送信待ちに入れて queued: true を返す */
export async function saveRecord(entity: string, data: Record<string, unknown>): Promise<{ row?: Row; queued: boolean; status?: string }> {
  const withId = { ...data, id: (data.id as string | undefined) ?? crypto.randomUUID() }
  try {
    const r = await api.post<{ row: Row; status: string }>(`/api/e/${entity}`, withId)
    return { row: r.row, queued: false, status: r.status }
  } catch (e) {
    if (!isNetworkError(e)) throw e
    writeOutbox([...readOutbox(), { entity, data: withId, queuedAt: new Date().toISOString() }])
    return { queued: true }
  }
}

/** 送信待ちを順に再送する。入力エラーで弾かれたものは送信待ちに残して理由を返す */
export async function flushOutbox(): Promise<{ sent: number; failed: { entity: string; error: string }[] }> {
  const list = readOutbox()
  const rest: Pending[] = []
  const failed: { entity: string; error: string }[] = []
  let sent = 0
  for (const p of list) {
    try {
      await api.post(`/api/e/${p.entity}`, p.data)
      sent++
    } catch (e) {
      rest.push(p)
      if (!isNetworkError(e)) failed.push({ entity: p.entity, error: (e as Error).message })
    }
  }
  writeOutbox(rest)
  return { sent, failed }
}

export function discardOutbox() {
  writeOutbox([])
}
