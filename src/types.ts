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

/** 1種目ぶんの読み取り結果 */
export interface WodMovement {
  /** ボードに書かれていたままの表記 (例: Thruster) */
  name: string
  /** 日本語訳 (例: スラスター) */
  nameJa: string
  /** 回数・距離など (例: 21-15-9 / 400m) */
  reps: string
  /** 重量・高さなど。書かれていなければ空文字 */
  load: string
}

/** 補助トレをどうするかの判定 */
export interface AccessoryAdvice {
  /** keep=そのまま / reduce=量を減らす / swap=種目を入れ替える / skip=中止 */
  verdict: 'keep' | 'reduce' | 'swap' | 'skip'
  /** 朝のWODの負荷 */
  amLoad: 'high' | 'medium' | 'low'
  /** 一言の結論 */
  headline: string
  /** WODのどこを見てそう判断したか */
  reason: string
  /** 変更後の内容。verdict が keep なら元のまま、skip なら空配列 */
  exercises: { name: string; nameJa: string; volume: string; change: string }[]
  /** やる場合の注意。無ければ空文字 */
  caution: string
  /** 判定に使ったプランの日付 */
  forDate: string
}

/** WODスキャンの結果。日付をキーに1件だけ保持する */
export interface ScannedWod {
  /** YYYY-MM-DD。「今日」タブのAMカードはこの日付で引く */
  date: string
  title: string
  /** AMRAP 12min / 5 Rounds For Time など */
  format: string
  movements: WodMovement[]
  notes: string
  /** 書かれていた文字をそのまま起こしたもの */
  raw: string
  confidence: 'high' | 'medium' | 'low'
  /** 自分のスコア (任意) */
  result: string
  /** 'claude' = API読み取り / 'tesseract' = 端末内OCR / 'manual' = 手入力 */
  source: 'claude' | 'tesseract' | 'manual'
  /** 補助トレの判定。読み取れなかった日や休養日には無い */
  advice?: AccessoryAdvice
  imageId?: string
  memoId?: string
  updatedAt: number
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
