import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { todayISO } from '../../../shared/analytics.ts'
import { entity, type FieldDef } from '../../../shared/schema.ts'
import { api, ApiError, saveRecord, type Row } from '../api.ts'
import { rowsOf, secLabel, useData } from '../data.tsx'
import { toast } from './ui.tsx'
import PhotoInput, { shrinkImage } from './PhotoInput.tsx'
import Icon from './Icon.tsx'
import { addDays } from '../../../shared/analytics.ts'

/** よく使う種目名 (入力候補)。記録済みの種目名も候補に足す */
export const COMMON_MOVEMENTS = [
  'Back Squat',
  'Front Squat',
  'Overhead Squat',
  'Deadlift',
  'Bench Press',
  'Strict Press',
  'Push Press',
  'Push Jerk',
  'Split Jerk',
  'Clean',
  'Power Clean',
  'Squat Clean',
  'Clean & Jerk',
  'Snatch',
  'Power Snatch',
  'Squat Snatch',
  'Thruster',
  'Weighted Pull-up',
  'Hip Thrust',
  'Romanian Deadlift',
]
export const COMMON_SKILLS = [
  'Ring Muscle-up',
  'Bar Muscle-up',
  'Strict Pull-up',
  'Chest to Bar',
  'Toes to Bar',
  'Handstand Push-up',
  'Strict HSPU',
  'Handstand Walk',
  'Double Under',
  'Rope Climb',
  'Legless Rope Climb',
  'Pistol',
  'Wall Walk',
]

/** サーバー側の機能 (WOD 写真の読み取りが使えるか) を1回だけ取得 */
let featuresPromise: Promise<{ wod_scan: boolean }> | null = null
function getFeatures() {
  featuresPromise ??= api
    .get<{ features?: { wod_scan: boolean } }>('/api/me')
    .then(r => r.features ?? { wod_scan: false })
    .catch(() => ({ wod_scan: false }))
  return featuresPromise
}

const HIDDEN = new Set(['source', 'workout_id', 'attachment_ids', 'metrics'])

function toInput(f: FieldDef, v: unknown): string {
  if (v == null) return ''
  if (f.name === 'duration_s') return secLabel(Number(v))
  if (f.type === 'json') {
    try {
      const j = JSON.parse(String(v))
      return Array.isArray(j) && j.every(x => typeof x === 'string') ? j.join(', ') : String(v)
    } catch {
      return String(v)
    }
  }
  return String(v)
}

/** "1:23:45" / "23:45" / "45" (分) → 秒 */
export function parseDuration(s: string): number | null {
  const t = s.trim()
  if (!t) return null
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(Number(t) * 60)
  const parts = t.split(':').map(Number)
  if (parts.some(p => !Number.isFinite(p))) return NaN
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1]
}

/** "6:30" / "6.5" (時間) / "390" (分) → 分 */
function parseSleep(s: string): number | null {
  const t = s.trim()
  if (!t) return null
  if (t.includes(':')) {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const n = Number(t)
  return n <= 24 ? Math.round(n * 60) : n
}

function fromInput(entityName: string, f: FieldDef, s: string): unknown {
  if (s === '') return null
  if (f.name === 'duration_s') return parseDuration(s)
  if (entityName === 'sleep_logs' && f.name === 'duration_min') return parseSleep(s)
  if (f.type === 'json') {
    if (/^[[{]/.test(s.trim())) return s
    return s
      .split(/[,、]/)
      .map(x => x.trim())
      .filter(Boolean)
  }
  if (f.type === 'bool') return s === '1'
  return s
}

export default function EntityForm({
  name,
  initial,
  defaults,
  onDone,
}: {
  name: string
  initial?: Row
  defaults?: Record<string, unknown>
  onDone: () => void
}) {
  const def = entity(name)!
  const { bundle, refresh } = useData()
  const editing = !!initial
  const [values, setValues] = useState<Record<string, string>>(() => {
    const src: Record<string, unknown> = { ...(defaults ?? {}), ...(initial ?? {}) }
    const out: Record<string, string> = {}
    for (const f of def.fields) {
      out[f.name] = toInput(f, src[f.name])
      if (!initial && f.type === 'date' && f.required && !out[f.name]) out[f.name] = todayISO()
      if (!initial && name === 'workouts' && f.name === 'type' && !out[f.name]) out[f.name] = 'crossfit'
    }
    return out
  })
  const [showMore, setShowMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [scanEnabled, setScanEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    if (name === 'workouts') getFeatures().then(f => setScanEnabled(f.wod_scan))
  }, [name])
  const [scan, setScan] = useState<{ state: 'idle' | 'busy' | 'done' | 'error'; msg?: string; preview?: string }>({ state: 'idle' })

  /** WOD の写真 → アップロード → Claude で読み取り → 空欄に自動入力 */
  async function scanWod(file: File | undefined) {
    if (!file) return
    const preview = URL.createObjectURL(file)
    setScan({ state: 'busy', msg: '写真を送信中…', preview })
    try {
      const blob = await shrinkImage(file, 2400)
      const up = await api.upload<{ id: string }>('/api/attachments', blob)
      setScan({ state: 'busy', msg: 'メニューを読み取り中… (10〜20秒)', preview })
      const r = await api.post<{ fields: Record<string, unknown>; wod: { confidence: string } }>('/api/wod/scan', { attachment_id: up.id })
      setValues(prev => {
        const next = { ...prev }
        for (const [k, v] of Object.entries(r.fields)) {
          if (v == null || v === '') continue
          // 手で入れた内容は消さない。空欄と「種類」だけ埋める
          if (!prev[k] || k === 'attachment_id') next[k] = String(v)
        }
        return next
      })
      setScan({
        state: 'done',
        preview,
        msg: r.wod.confidence === 'high' ? '読み取りました。内容を確認して保存してください' : '読み取りました。自信がない文字があるので、内容を確認してください',
      })
    } catch (e) {
      setScan({ state: 'error', preview, msg: (e as Error).message })
    }
  }

  const suggestions = useMemo(() => {
    const fromData = (ent: string, field: string) => rowsOf(bundle, ent).map(r => String(r[field] ?? ''))
    return {
      movement: [...new Set([...fromData('strength_sets', 'movement'), ...COMMON_MOVEMENTS])].filter(Boolean),
      skill: [...new Set([...fromData('skill_logs', 'skill'), ...COMMON_SKILLS])].filter(Boolean),
    }
  }, [bundle])

  const fields = def.fields.filter(f => !f.computed && !HIDDEN.has(f.name))
  const primary = fields.filter(f => f.primary)
  const rest = fields.filter(f => !f.primary)

  const set = (k: string, v: string) => setValues(prev => ({ ...prev, [k]: v }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrors([])
    const payload: Record<string, unknown> = {}
    for (const f of fields) {
      const v = fromInput(name, f, values[f.name] ?? '')
      if (Number.isNaN(v)) {
        setErrors([`${f.label} の形式を確認してください`])
        setBusy(false)
        return
      }
      if (editing) {
        if (toInput(f, initial![f.name]) !== (values[f.name] ?? '')) payload[f.name] = v
      } else if (v != null && v !== '') payload[f.name] = v
    }
    try {
      if (editing) {
        if (Object.keys(payload).length) await api.patch(`/api/e/${name}/${initial!.id}`, payload)
        toast('更新しました')
      } else {
        const r = await saveRecord(name, payload)
        if (r.queued) toast('通信できないため端末に保存しました。つながったら自動で送信します', 'warn')
        else toast(r.status === 'merged' ? '同じ日の記録に追記しました' : '保存しました')
      }
      await refresh()
      onDone()
    } catch (err) {
      const d = err instanceof ApiError && Array.isArray(err.details) ? (err.details as string[]) : []
      setErrors([(err as Error).message, ...d])
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!initial || !confirm('この記録をゴミ箱に移動します。「その他 → ゴミ箱」からいつでも戻せます。')) return
    setBusy(true)
    try {
      await api.del(`/api/e/${name}/${initial.id}`)
      toast('ゴミ箱に移動しました')
      await refresh()
      onDone()
    } catch (err) {
      setErrors([(err as Error).message])
    } finally {
      setBusy(false)
    }
  }

  const renderField = (f: FieldDef) => {
    const v = values[f.name] ?? ''
    const id = `f-${name}-${f.name}`
    let input
    if (f.type === 'enum' && (f.options?.length ?? 0) <= 7) {
      input = (
        <div className="chips">
          {f.options!.map(([ov, ol]) => (
            <button type="button" key={ov} className={v === ov ? 'chip on' : 'chip'} onClick={() => set(f.name, v === ov ? '' : ov)}>
              {ol}
            </button>
          ))}
        </div>
      )
    } else if (f.type === 'enum') {
      input = (
        <select id={id} value={v} onChange={e => set(f.name, e.target.value)}>
          <option value="">—</option>
          {f.options!.map(([ov, ol]) => (
            <option key={ov} value={ov}>
              {ol}
            </option>
          ))}
        </select>
      )
    } else if (f.type === 'int' && f.min === 1 && f.max === 5) {
      input = (
        <div className="chips scale">
          {[1, 2, 3, 4, 5].map(n => (
            <button type="button" key={n} className={v === String(n) ? 'chip on' : 'chip'} onClick={() => set(f.name, v === String(n) ? '' : String(n))}>
              {n}
            </button>
          ))}
        </div>
      )
    } else if (f.type === 'bool') {
      input = (
        <div className="chips">
          <button type="button" className={v === '1' ? 'chip on' : 'chip'} onClick={() => set(f.name, v === '1' ? '' : '1')}>
            はい
          </button>
          <button type="button" className={v === '0' ? 'chip on' : 'chip'} onClick={() => set(f.name, v === '0' ? '' : '0')}>
            いいえ
          </button>
        </div>
      )
    } else if (f.type === 'date') {
      const t = todayISO()
      input = (
        <div className="date-row">
          <input id={id} type="date" value={v} onChange={e => set(f.name, e.target.value)} />
          <div className="chips">
            {(
              [
                ['今日', t],
                ['昨日', addDays(t, -1)],
              ] as [string, string][]
            ).map(([l, d]) => (
              <button type="button" key={l} className={v === d ? 'chip on' : 'chip'} onClick={() => set(f.name, d)}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )
    } else if (f.type === 'longtext') {
      input = <textarea id={id} value={v} rows={f.name === 'body_md' ? 12 : 3} placeholder={f.placeholder} onChange={e => set(f.name, e.target.value)} />
    } else if (f.type === 'ref' && f.ref === 'attachments') {
      input = <PhotoInput value={v} onChange={nv => set(f.name, nv)} />
    } else {
      const isNum = f.type === 'int' || f.type === 'real'
      const special = f.name === 'duration_s' || (name === 'sleep_logs' && f.name === 'duration_min')
      const list = f.name === 'movement' ? 'dl-movement' : f.name === 'skill' ? 'dl-skill' : undefined
      input = (
        <input
          id={id}
          type={special ? 'text' : f.type === 'time' ? 'time' : 'text'}
          inputMode={special ? 'text' : f.type === 'int' ? 'numeric' : isNum ? 'decimal' : undefined}
          value={v}
          list={list}
          placeholder={
            f.name === 'duration_s' ? '25:30 / 1:05:00 (分だけなら 30)' : name === 'sleep_logs' && f.name === 'duration_min' ? '6:30 または 6.5 (時間)' : f.placeholder
          }
          onChange={e => set(f.name, e.target.value)}
        />
      )
    }
    return (
      <div className={`field ${f.type === 'longtext' || f.type === 'date' ? 'wide' : ''}`} key={f.name}>
        <label htmlFor={id}>
          {f.name === 'duration_min' && name === 'sleep_logs' ? '睡眠時間' : f.label}
          {f.unit && f.name !== 'duration_s' && !(name === 'sleep_logs' && f.name === 'duration_min') && <span className="unit">{f.unit}</span>}
          {f.required && <span className="req">必須</span>}
        </label>
        {input}
      </div>
    )
  }

  return (
    <form className="entity-form" onSubmit={submit}>
      <datalist id="dl-movement">
        {suggestions.movement.map(m => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <datalist id="dl-skill">
        {suggestions.skill.map(m => (
          <option key={m} value={m} />
        ))}
      </datalist>
      {name === 'workouts' && scanEnabled === false && !editing && (
        <div className="scan-box hint">
          <Icon name="camera" size={22} />
          <div className="scan-text">
            <b>ホワイトボードの写真は Claude Code へ</b>
            <small>写真を送って「今日のWOD」と伝えると、読み取ってここに記録します (追加料金なし)</small>
          </div>
        </div>
      )}
      {name === 'workouts' && scanEnabled && (
        <div className={`scan-box ${scan.state}`}>
          {scan.preview && <img src={scan.preview} alt="" />}
          <div className="scan-text">
            <b>{scan.state === 'idle' ? 'ホワイトボードを撮影して自動入力' : scan.state === 'busy' ? '読み取り中' : scan.state === 'done' ? '自動入力しました' : '読み取れませんでした'}</b>
            <small>{scan.msg ?? 'タイトル・形式・種目と重量を写真から入力します'}</small>
          </div>
          <label className={`btn ${scan.state === 'idle' ? 'primary' : ''} small`}>
            <Icon name="camera" size={18} />
            {scan.state === 'busy' ? '…' : scan.state === 'idle' ? '撮影' : '撮り直す'}
            <input type="file" accept="image/*" capture="environment" hidden disabled={scan.state === 'busy'} onChange={e => scanWod(e.target.files?.[0])} />
          </label>
        </div>
      )}
      <div className="fields">{primary.map(renderField)}</div>
      {rest.length > 0 && (
        <>
          <button type="button" className="link-btn" onClick={() => setShowMore(s => !s)}>
            {showMore ? '詳細を閉じる' : `詳細項目 (${rest.map(f => f.label).slice(0, 3).join('・')}など)`}
          </button>
          {showMore && <div className="fields">{rest.map(renderField)}</div>}
        </>
      )}
      {errors.length > 0 && (
        <div className="errors" role="alert">
          {errors.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      )}
      <div className="form-actions sticky">
        {editing && (
          <button type="button" className="btn danger" onClick={remove} disabled={busy}>
            削除
          </button>
        )}
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? '保存中…' : editing ? '更新する' : `${def.label}を保存`}
        </button>
      </div>
      {editing && initial?.source ? <p className="muted small">入力元: {String(initial.source)} ・ 最終更新 {String(initial.updated_at ?? '').slice(0, 16).replace('T', ' ')}</p> : null}
    </form>
  )
}
