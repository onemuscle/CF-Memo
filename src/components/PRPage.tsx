import { useMemo, useState } from 'react'
import { deletePR, putPR } from '../db'
import { formatDate, movementKeyOf, newId, today, type PR } from '../types'
import { BackIcon, PlusIcon, SearchIcon, TrashIcon } from './Icons'

const KG_PER_LB = 0.45359237

function toKg(pr: PR): number | null {
  if (pr.weight == null) return null
  return pr.unit === 'lb' ? pr.weight * KG_PER_LB : pr.weight
}

function weightLabel(pr: PR): string {
  if (pr.weight == null) return pr.score || '—'
  return `${pr.weight}${pr.unit}${pr.reps ? ` × ${pr.reps}` : ''}`
}

// ---- 種目一覧 ----

interface ListProps {
  prs: PR[]
  onOpenMovement: (movementKey: string) => void
  onNew: () => void
}

export function PRList({ prs, onOpenMovement, onNew }: ListProps) {
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const map = new Map<string, PR[]>()
    for (const pr of prs) {
      const list = map.get(pr.movementKey) ?? []
      list.push(pr)
      map.set(pr.movementKey, list)
    }
    return Array.from(map.entries())
      .map(([key, entries]) => {
        const best = entries.reduce<PR | null>((acc, pr) => {
          const kg = toKg(pr)
          if (kg == null) return acc
          return acc == null || kg > toKg(acc)! ? pr : acc
        }, null)
        return { key, movement: entries[0].movement, entries, best, latest: entries[0] }
      })
      .filter(g => !query.trim() || g.movement.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => b.latest.date.localeCompare(a.latest.date))
  }, [prs, query])

  return (
    <div className="page">
      <div className="search-box">
        <SearchIcon size={18} />
        <input
          type="search"
          placeholder="種目を検索 (例: Push Press)"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {groups.length === 0 ? (
        <div className="empty">
          <p>{prs.length === 0 ? 'まだPR記録がありません。' : '該当する種目が見つかりません。'}</p>
          {prs.length === 0 && <p className="empty-sub">右下の + からベスト記録を残しましょう。</p>}
        </div>
      ) : (
        <ul className="memo-list">
          {groups.map(g => (
            <li key={g.key}>
              <button className="pr-card" onClick={() => onOpenMovement(g.key)}>
                <div className="pr-card-main">
                  <h3 className="pr-movement">{g.movement}</h3>
                  <div className="pr-meta">
                    {g.entries.length}件 · 最終 {formatDate(g.latest.date)}
                  </div>
                </div>
                <div className="pr-best">
                  <div className="pr-best-label">BEST</div>
                  <div className="pr-best-value">
                    {g.best ? weightLabel(g.best) : g.latest.score || '—'}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button className="fab" onClick={onNew} aria-label="PRを追加">
        <PlusIcon size={26} />
      </button>
    </div>
  )
}

// ---- 推移チャート ----

function ProgressChart({ entries }: { entries: PR[] }) {
  const points = entries
    .filter(e => e.weight != null)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
  if (points.length < 2) return null

  const w = 320
  const h = 120
  const pad = 14
  const values = points.map(p => toKg(p)!)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2)
    const y = h - pad - ((toKg(p)! - min) / span) * (h - pad * 2)
    return [x, y] as const
  })
  const path = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} className="chart" preserveAspectRatio="none">
        <polyline points={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3.5" fill="var(--accent)" />
        ))}
      </svg>
      <div className="chart-legend">
        <span>MIN {Math.round(min * 10) / 10}kg</span>
        <span>MAX {Math.round(max * 10) / 10}kg</span>
      </div>
    </div>
  )
}

// ---- 種目詳細 (履歴) ----

interface DetailProps {
  prs: PR[]
  movementKey: string
  onBack: () => void
  onEdit: (id: string) => void
  onAdd: (movement: string) => void
  onChanged: () => void
}

export function MovementDetail({ prs, movementKey, onBack, onEdit, onAdd, onChanged }: DetailProps) {
  const entries = prs.filter(p => p.movementKey === movementKey)
  if (entries.length === 0) {
    return (
      <div className="page">
        <div className="topbar">
          <button className="icon-btn" onClick={onBack} aria-label="戻る">
            <BackIcon />
          </button>
        </div>
        <div className="empty">
          <p>この種目の記録はありません。</p>
        </div>
      </div>
    )
  }

  const movement = entries[0].movement
  const best = entries.reduce<PR | null>((acc, pr) => {
    const kg = toKg(pr)
    if (kg == null) return acc
    return acc == null || kg > toKg(acc)! ? pr : acc
  }, null)

  async function handleDelete(pr: PR) {
    if (!confirm(`${formatDate(pr.date)} の記録を削除しますか？`)) return
    await deletePR(pr.id)
    onChanged()
  }

  return (
    <div className="page">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="戻る">
          <BackIcon />
        </button>
        <button className="btn-primary" onClick={() => onAdd(movement)}>
          + 記録追加
        </button>
      </div>

      <div className="detail-head">
        <h2 className="detail-title">{movement}</h2>
        {best && (
          <div className="best-banner">
            <span className="pr-best-label">ALL-TIME PR</span>
            <span className="best-banner-value">{weightLabel(best)}</span>
            <span className="best-banner-date">{formatDate(best.date)}</span>
          </div>
        )}
      </div>

      <ProgressChart entries={entries} />

      <ul className="history-list">
        {entries.map(pr => (
          <li key={pr.id} className="history-item">
            <button className="history-main" onClick={() => onEdit(pr.id)}>
              <div className="history-value">
                {weightLabel(pr)}
                {best?.id === pr.id && <span className="pr-flag">PR</span>}
              </div>
              <div className="history-sub">
                {formatDate(pr.date)}
                {pr.weight != null && pr.score ? ` · ${pr.score}` : ''}
                {pr.note ? ` · ${pr.note}` : ''}
              </div>
            </button>
            <button className="icon-btn danger" onClick={() => handleDelete(pr)} aria-label="削除">
              <TrashIcon size={17} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---- 記録フォーム ----

interface FormProps {
  pr?: PR
  prs: PR[]
  defaultMovement?: string
  onSaved: (pr: PR) => void
  onDeleted: (pr: PR) => void
  onCancel: () => void
}

export function PRForm({ pr, prs, defaultMovement, onSaved, onDeleted, onCancel }: FormProps) {
  const [movement, setMovement] = useState(pr?.movement ?? defaultMovement ?? '')
  const [weight, setWeight] = useState(pr?.weight?.toString() ?? '')
  const [unit, setUnit] = useState<'kg' | 'lb'>(pr?.unit ?? 'kg')
  const [reps, setReps] = useState(pr?.reps?.toString() ?? '')
  const [score, setScore] = useState(pr?.score ?? '')
  const [date, setDate] = useState(pr?.date ?? today())
  const [note, setNote] = useState(pr?.note ?? '')

  const movements = useMemo(
    () => Array.from(new Map(prs.map(p => [p.movementKey, p.movement])).values()).sort(),
    [prs],
  )

  const pastEntries = useMemo(() => {
    const key = movementKeyOf(movement)
    if (!key) return []
    return prs.filter(p => p.movementKey === key && p.id !== pr?.id).slice(0, 5)
  }, [movement, prs, pr])

  async function handleSave() {
    if (!movement.trim()) {
      alert('種目名を入力してください。')
      return
    }
    const saved: PR = {
      id: pr?.id ?? newId(),
      movement: movement.trim(),
      movementKey: movementKeyOf(movement),
      weight: weight.trim() ? Number(weight) : null,
      unit,
      reps: reps.trim() ? Number(reps) : null,
      score: score.trim(),
      date,
      note: note.trim(),
      createdAt: pr?.createdAt ?? Date.now(),
    }
    await putPR(saved)
    onSaved(saved)
  }

  async function handleDelete() {
    if (!pr) return
    if (!confirm('この記録を削除しますか？')) return
    await deletePR(pr.id)
    onDeleted(pr)
  }

  return (
    <div className="page">
      <div className="topbar">
        <button className="icon-btn" onClick={onCancel} aria-label="戻る">
          <BackIcon />
        </button>
        <span className="topbar-title">{pr ? '記録を編集' : 'PR記録を追加'}</span>
        <button className="btn-primary" onClick={handleSave}>
          保存
        </button>
      </div>

      <label className="field-label">種目名</label>
      <input
        className="input"
        list="movement-list"
        placeholder="例: Push Press / Back Squat / Fran"
        value={movement}
        onChange={e => setMovement(e.target.value)}
      />
      <datalist id="movement-list">
        {movements.map(m => (
          <option key={m} value={m} />
        ))}
      </datalist>

      <div className="field-grid">
        <div>
          <label className="field-label">重量</label>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            placeholder="例: 80"
            value={weight}
            onChange={e => setWeight(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">単位</label>
          <select className="input" value={unit} onChange={e => setUnit(e.target.value as 'kg' | 'lb')}>
            <option value="kg">kg</option>
            <option value="lb">lb</option>
          </select>
        </div>
        <div>
          <label className="field-label">レップ数</label>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            placeholder="例: 1"
            value={reps}
            onChange={e => setReps(e.target.value)}
          />
        </div>
      </div>

      <label className="field-label">スコア (タイム・ラウンド数など)</label>
      <input
        className="input"
        placeholder="例: 3:21 / 15 rounds / RX"
        value={score}
        onChange={e => setScore(e.target.value)}
      />

      <label className="field-label">日付</label>
      <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />

      <label className="field-label">メモ</label>
      <input
        className="input"
        placeholder="例: ベルトあり / 体調イマイチ"
        value={note}
        onChange={e => setNote(e.target.value)}
      />

      {pastEntries.length > 0 && (
        <div className="past-box">
          <div className="past-box-title">この種目の過去記録</div>
          <ul>
            {pastEntries.map(p => (
              <li key={p.id}>
                <span>{formatDate(p.date)}</span>
                <span>{weightLabel(p)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pr && (
        <button className="btn-danger" onClick={handleDelete}>
          この記録を削除
        </button>
      )}
    </div>
  )
}
