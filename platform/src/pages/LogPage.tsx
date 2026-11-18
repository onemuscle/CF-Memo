import { useMemo, useState } from 'react'
import { ENTITIES, entity, type EntityDef } from '../../../shared/schema.ts'
import { Empty, Segmented } from '../components/ui.tsx'
import Icon from '../components/Icon.tsx'
import type { Row } from '../api.ts'
import { rowTitle, rowsOf, useData } from '../data.tsx'

export type QuickKind = keyof typeof ENTITIES

const GROUPS: [string, string][] = [
  ['all', 'すべて'],
  ['training', 'トレ'],
  ['endurance', '持久'],
  ['body', '体・食事'],
  ['recovery', '回復'],
]

export default function LogPage({ onOpen }: { onOpen: (name: string, row?: Row) => void }) {
  const { bundle } = useData()
  const [group, setGroup] = useState('all')
  const [days, setDays] = useState(21)

  const timeline = useMemo(() => {
    const byDate = new Map<string, { name: string; row: Row }[]>()
    for (const d of Object.values(ENTITIES) as unknown as EntityDef[]) {
      if (!d.dateField || d.group === 'plan' && d.name !== 'journal') continue
      if (group !== 'all' && d.group !== group) continue
      for (const r of rowsOf(bundle, d.name)) {
        const date = String(r[d.dateField] ?? '')
        if (!date) continue
        byDate.set(date, [...(byDate.get(date) ?? []), { name: d.name, row: r }])
      }
    }
    return [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [bundle, group])

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">HISTORY</div>
          <h1>履歴</h1>
        </div>
      </header>

      <Segmented value={group} options={GROUPS} onChange={setGroup} />

      {timeline.length === 0 && <Empty>まだ記録がありません。下の ＋ から記録できます。</Empty>}
      {timeline.slice(0, days).map(([date, items]) => (
        <section key={date} className="day">
          <h3 className="day-head">
            {date.replace(/-/g, '/')} <span>{'日月火水木金土'[new Date(date + 'T00:00:00').getDay()]}</span>
          </h3>
          {items.map(({ name, row }) => (
            <button key={row.id} className="entry" onClick={() => onOpen(name, row)}>
              <span className={`entry-icon g-${entity(name)!.group}`}>
                <Icon name={name} size={18} />
              </span>
              <span className="entry-title">
                {rowTitle(name, row)}
                <small>{entity(name)!.label}{row.source === 'health' ? ' ・ Apple ヘルスケア' : row.source === 'agent' ? ' ・ Claude Code' : ''}</small>
              </span>
              {row.note ? <span className="entry-note">{String(row.note).slice(0, 60)}</span> : null}
              {name === 'workouts' && row.description ? <span className="entry-note">{String(row.description).slice(0, 80)}</span> : null}
            </button>
          ))}
        </section>
      ))}
      {timeline.length > days && (
        <button className="btn ghost wide" onClick={() => setDays(d => d + 30)}>
          さらに表示
        </button>
      )}
    </div>
  )
}
