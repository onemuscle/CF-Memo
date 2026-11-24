import { useState } from 'react'
import type { CatalogGroup } from '../../../shared/movements.ts'

const OTHER = '__other__'

/**
 * 種目・スキルを一覧から選ぶ (iPhone ではドラム式の選択画面になる)。
 * 一番上に最近使った種目、一覧に無いものは「その他」から手入力。
 */
export default function MovementSelect({
  id,
  value,
  onChange,
  catalog,
  recent,
  placeholder,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  catalog: CatalogGroup[]
  recent: string[]
  placeholder: string
}) {
  const known = new Set(catalog.flatMap(g => g.items.map(([en]) => en)))
  const recentOnly = recent.filter(r => r && !known.has(r))
  const [custom, setCustom] = useState(() => !!value && !known.has(value) && !recent.includes(value))
  const ja = new Map(catalog.flatMap(g => g.items))
  const recentTop = [...new Set(recent)].filter(Boolean).slice(0, 6)

  return (
    <div className="movement-select">
      <select
        id={id}
        value={custom ? OTHER : value}
        onChange={e => {
          if (e.target.value === OTHER) {
            setCustom(true)
            onChange('')
          } else {
            setCustom(false)
            onChange(e.target.value)
          }
        }}
      >
        <option value="">種目を選ぶ</option>
        {recentTop.length > 0 && (
          <optgroup label="最近使った種目">
            {recentTop.map(r => (
              <option key={`r-${r}`} value={r}>
                {ja.get(r) ? `${r} (${ja.get(r)})` : r}
              </option>
            ))}
          </optgroup>
        )}
        {catalog.map(g => (
          <optgroup key={g.group} label={g.group}>
            {g.items.map(([en, j]) => (
              <option key={en} value={en}>
                {en} ({j})
              </option>
            ))}
          </optgroup>
        ))}
        {recentOnly.length > 0 && (
          <optgroup label="自分で追加した種目">
            {recentOnly.map(r => (
              <option key={`c-${r}`} value={r}>
                {r}
              </option>
            ))}
          </optgroup>
        )}
        <option value={OTHER}>その他 (自分で入力)…</option>
      </select>
      {custom && (
        <input
          aria-label="種目名を入力"
          value={value}
          placeholder={placeholder}
          autoFocus
          autoCapitalize="words"
          onChange={e => onChange(e.target.value)}
        />
      )}
    </div>
  )
}
