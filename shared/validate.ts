import { applyComputed, entity, type EntityName, type FieldDef } from './schema.ts'

export interface ValidationResult {
  ok: boolean
  /** DB にそのまま入れられる値 (列名 → 値) */
  values: Record<string, unknown>
  errors: string[]
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const MAX_TEXT = 20000

/**
 * 入力値を検証して DB 用の値に変換する。
 *
 * - 定義にない項目はエラーにする (CLI の打ち間違いが黙って捨てられないように)
 * - partial=true は更新用。渡された項目だけを検証する
 * - 計算列 (computed) は受け付けず、applyComputed で作り直す
 */
export function validate(
  name: EntityName,
  input: Record<string, unknown>,
  opts: { partial?: boolean; allowMeta?: boolean } = {},
): ValidationResult {
  const def = entity(name)
  if (!def) return { ok: false, values: {}, errors: [`不明な記録の種類: ${name}`] }
  const errors: string[] = []
  const values: Record<string, unknown> = {}
  const fields = new Map(def.fields.map(f => [f.name, f]))
  const meta = new Set(['id', 'created_at', 'updated_at', 'deleted_at'])

  for (const [key, raw] of Object.entries(input)) {
    if (meta.has(key)) {
      if (key === 'id') {
        if (raw != null && (typeof raw !== 'string' || !ID_RE.test(raw))) errors.push('id は英数字・_・- の64文字以内です')
        else if (raw != null) values.id = raw
      } else if (opts.allowMeta) {
        if (raw != null && typeof raw !== 'string') errors.push(`${key} は日時文字列です`)
        else values[key] = raw ?? null
      }
      continue
    }
    const f = fields.get(key)
    if (!f) {
      errors.push(`「${def.label}」に ${key} という項目はありません`)
      continue
    }
    if (f.computed) continue
    const r = coerce(f, raw)
    if (r.error) errors.push(`${f.label}: ${r.error}`)
    else values[key] = r.value
  }

  if (!opts.partial) {
    for (const f of def.fields) {
      if (f.required && (values[f.name] == null || values[f.name] === '')) errors.push(`${f.label} は必須です`)
    }
  }

  return { ok: errors.length === 0, values, errors }
}

export function coerce(f: FieldDef, raw: unknown): { value?: unknown; error?: string } {
  if (raw === null || raw === undefined || raw === '') return { value: null }
  switch (f.type) {
    case 'int':
    case 'real': {
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.replace(/,/g, '')) : NaN
      if (!Number.isFinite(n)) return { error: `数値ではありません (${String(raw)})` }
      if (f.type === 'int' && !Number.isInteger(n)) return { error: `整数で入力してください (${n})` }
      if (f.min != null && n < f.min) return { error: `${f.min} 以上にしてください (${n})` }
      if (f.max != null && n > f.max) return { error: `${f.max} 以下にしてください (${n})` }
      return { value: n }
    }
    case 'bool':
      if (raw === true || raw === 1 || raw === '1' || raw === 'true') return { value: 1 }
      if (raw === false || raw === 0 || raw === '0' || raw === 'false') return { value: 0 }
      return { error: 'true / false で入力してください' }
    case 'date':
      if (typeof raw !== 'string' || !DATE_RE.test(raw) || Number.isNaN(Date.parse(raw))) return { error: `YYYY-MM-DD 形式にしてください (${String(raw)})` }
      return { value: raw }
    case 'time':
      if (typeof raw !== 'string' || !TIME_RE.test(raw)) return { error: `HH:MM 形式にしてください (${String(raw)})` }
      return { value: raw }
    case 'datetime':
      if (typeof raw !== 'string' || Number.isNaN(Date.parse(raw))) return { error: '日時の形式が正しくありません' }
      return { value: raw }
    case 'enum': {
      const allowed = f.options?.map(o => o[0]) ?? []
      if (typeof raw !== 'string' || !allowed.includes(raw)) return { error: `${allowed.join(' / ')} のどれかにしてください (${String(raw)})` }
      return { value: raw }
    }
    case 'json': {
      if (typeof raw === 'string') {
        try {
          JSON.parse(raw)
          return raw.length > MAX_TEXT ? { error: '長すぎます' } : { value: raw }
        } catch {
          return { error: 'JSON として読めません' }
        }
      }
      const s = JSON.stringify(raw)
      return s.length > MAX_TEXT ? { error: '長すぎます' } : { value: s }
    }
    case 'ref':
      if (typeof raw !== 'string' || !ID_RE.test(raw)) return { error: 'id の形式が正しくありません' }
      return { value: raw }
    default: {
      if (typeof raw !== 'string' && typeof raw !== 'number') return { error: '文字列で入力してください' }
      const s = String(raw)
      if (s.length > MAX_TEXT) return { error: `${MAX_TEXT}文字以内にしてください` }
      return { value: s }
    }
  }
}

/** 検証済みの値に計算列を足したもの (保存直前の形) */
export function finalize(name: EntityName, values: Record<string, unknown>): Record<string, unknown> {
  return applyComputed(name, values)
}
