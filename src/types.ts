export type Category = 'wod' | 'meal' | 'rest' | 'note'

export const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  wod: { label: 'WOD', color: '#c6ff3e' },
  meal: { label: '食事', color: '#ff9f43' },
  rest: { label: '休養', color: '#4dd6ff' },
  note: { label: 'その他', color: '#b18cff' },
}

export interface Memo {
  id: string
  category: Category
  title: string
  body: string
  tags: string[]
  imageIds: string[]
  createdAt: number
  updatedAt: number
}

export interface StoredImage {
  id: string
  blob: Blob
  createdAt: number
}

export interface PR {
  id: string
  /** 表示用の種目名 (例: Push Press) */
  movement: string
  /** 正規化キー (小文字・空白圧縮) — 同一種目のグルーピングに使用 */
  movementKey: string
  weight: number | null
  unit: 'kg' | 'lb'
  reps: number | null
  /** タイムや回数など自由記述のスコア (例: "3:21", "21-15-9 RX") */
  score: string
  date: string // YYYY-MM-DD
  note: string
  createdAt: number
}

export function movementKeyOf(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function newId(): string {
  return crypto.randomUUID()
}

/** Date → YYYY-MM-DD (ローカルタイム基準。UTC変換だと朝の記録が前日になる) */
export function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function today(): string {
  return toISO(new Date())
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${y}/${Number(m)}/${Number(d)}`
}
