import { useMemo, useState } from 'react'
import { ENTITIES, entity, type EntityDef } from '../../../shared/schema.ts'
import { Card, Empty, Segmented } from '../components/ui.tsx'
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

const ADDABLE: QuickKind[] = [
  'workouts',
  'strength_sets',
  'skill_logs',
  'cardio_sessions',
  'races',
  'body_metrics',
  'nutrition_entries',
  'sleep_logs',
  'wellness',
  'injuries',
  'supplements',
  'nutrition_targets',
  'journal',
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
        <h1>LOG</h1>
      </header>
      <Card title="記録する">
        <div className="add-grid">
          {ADDABLE.map(n => (
            <button key={n} className="add-btn" onClick={() => onOpen(n)}>
              + {entity(n)!.label}
            </button>
          ))}
        </div>
      </Card>

      <Segmented value={group} options={GROUPS} onChange={setGroup} />

      {timeline.length === 0 && <Empty>まだ記録がありません。上のボタンから記録できます。</Empty>}
      {timeline.slice(0, days).map(([date, items]) => (
        <section key={date} className="day">
          <h3 className="day-head">
            {date.replace(/-/g, '/')} <span>{'日月火水木金土'[new Date(date + 'T00:00:00').getDay()]}</span>
          </h3>
          {items.map(({ name, row }) => (
            <button key={row.id} className="entry" onClick={() => onOpen(name, row)}>
              <span className={`tag g-${entity(name)!.group}`}>{entity(name)!.label}</span>
              <span className="entry-title">{rowTitle(name, row)}</span>
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
