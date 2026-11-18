import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { addDays, todayISO, type Bundle } from '../../shared/analytics.ts'
import { entity, type FieldDef } from '../../shared/schema.ts'
import { api, flushOutbox, outboxCount, type Row } from './api.ts'

/**
 * 画面全体で使う記録データ。起動時に直近の記録をまとめて取得し、保存のたびに取り直す。
 * 範囲は既定で過去 400 日 (年間比較ができる長さ)。「全期間」に切り替えると全件を読む。
 */

interface DataState {
  bundle: Bundle | null
  loading: boolean
  error: string | null
  range: 'recent' | 'all'
  setRange: (r: 'recent' | 'all') => void
  refresh: () => Promise<void>
  pending: number
}

const Ctx = createContext<DataState | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<'recent' | 'all'>('recent')
  const [pending, setPending] = useState(outboxCount())

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      if (outboxCount() > 0 && navigator.onLine) await flushOutbox()
      const from = range === 'all' ? '' : `from=${addDays(todayISO(), -400)}&`
      const b = await api.get<Bundle>(`/api/bundle?${from}reports=1`)
      setBundle(b)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
      setPending(outboxCount())
    }
  }, [range])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onOutbox = () => setPending(outboxCount())
    const onOnline = () => refresh()
    window.addEventListener('cfm-outbox', onOutbox)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('cfm-outbox', onOutbox)
      window.removeEventListener('online', onOnline)
    }
  }, [refresh])

  return <Ctx.Provider value={{ bundle, loading, error, range, setRange, refresh, pending }}>{children}</Ctx.Provider>
}

export function useData(): DataState {
  const v = useContext(Ctx)
  if (!v) throw new Error('DataProvider の外で useData が呼ばれました')
  return v
}

export function rowsOf(b: Bundle | null, name: string): Row[] {
  return ((b?.data[name] ?? []) as Row[]).filter(r => !r.deleted_at)
}

// ---- 表示用 ----

export function fieldValueLabel(f: FieldDef, v: unknown): string {
  if (v == null || v === '') return ''
  if (f.type === 'enum') return f.options?.find(o => o[0] === v)?.[1] ?? String(v)
  if (f.type === 'bool') return v ? 'はい' : 'いいえ'
  if (f.name === 'duration_s') return secLabel(Number(v))
  if (f.name === 'duration_min' && f.unit === '分' && Number(v) >= 90) return `${Math.floor(Number(v) / 60)}時間${Math.round(Number(v) % 60)}分`
  if (f.type === 'json') {
    try {
      const j = JSON.parse(String(v))
      return Array.isArray(j) ? j.join(', ') : String(v)
    } catch {
      return String(v)
    }
  }
  return `${typeof v === 'number' ? fmtNum(v) : String(v)}${f.unit && f.unit !== '秒' ? ` ${f.unit}` : ''}`
}

export function fmtNum(v: number): string {
  return Number.isInteger(v) ? v.toLocaleString('ja-JP') : (Math.round(v * 10) / 10).toLocaleString('ja-JP')
}

export function secLabel(sec: number): string {
  if (!Number.isFinite(sec)) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.round(sec % 60)
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

/** 一覧で1行にまとめる見出し */
export function rowTitle(name: string, r: Row): string {
  const d = entity(name)
  if (!d) return r.id
  switch (name) {
    case 'strength_sets':
      return `${r.movement} ${r.weight_kg ?? '—'}kg × ${r.reps ?? '—'}${r.sets && Number(r.sets) > 1 ? ` × ${r.sets}セット` : ''}`
    case 'sleep_logs':
      return `睡眠 ${r.duration_min != null ? fieldValueLabel(d.fields.find(f => f.name === 'duration_min')!, r.duration_min) : '—'}${r.quality ? ` / 質 ${r.quality}` : ''}`
    case 'cardio_sessions': {
      const f = (n: string) => d.fields.find(x => x.name === n)!
      return [fieldValueLabel(f('modality'), r.modality), r.distance_m ? `${fmtNum(Number(r.distance_m) / 1000)}km` : '', r.duration_s ? secLabel(Number(r.duration_s)) : '', r.kind ? fieldValueLabel(f('kind'), r.kind) : '']
        .filter(Boolean)
        .join(' ')
    }
    case 'body_metrics':
      return [r.weight_kg ? `${r.weight_kg}kg` : '', r.body_fat_pct ? `体脂肪 ${r.body_fat_pct}%` : '', r.waist_cm ? `腹囲 ${r.waist_cm}cm` : ''].filter(Boolean).join(' / ') || '体組成'
    case 'nutrition_entries':
      return `${fieldValueLabel(d.fields.find(f => f.name === 'meal')!, r.meal) || '食事'} ${r.kcal ? `${fmtNum(Number(r.kcal))}kcal` : ''} ${r.protein_g ? `P${fmtNum(Number(r.protein_g))}` : ''}`.trim()
    case 'wellness':
      return `疲労 ${r.fatigue ?? '—'} / 筋肉痛 ${r.soreness ?? '—'} / ストレス ${r.stress ?? '—'}`
  }
  const parts = d.titleFields.map(fn => {
    const f = d.fields.find(x => x.name === fn)
    return f ? fieldValueLabel(f, r[fn]) : ''
  })
  return parts.filter(Boolean).join(' · ') || d.label
}
