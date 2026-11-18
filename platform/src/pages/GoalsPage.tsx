import { goalProgress, metricSeries, todayISO } from '../../../shared/analytics.ts'
import { LineChart } from '../components/Chart.tsx'
import { Card, Empty, Progress } from '../components/ui.tsx'
import type { Row } from '../api.ts'
import { rowsOf, useData } from '../data.tsx'

export default function GoalsPage({ onOpen }: { onOpen: (name: string, row?: Row, defaults?: Record<string, unknown>) => void }) {
  const { bundle } = useData()
  if (!bundle) return null
  const today = todayISO()
  const goals = rowsOf(bundle, 'goals').sort((a, b) => Number(a.priority ?? 9) - Number(b.priority ?? 9) || String(a.target_date ?? '9').localeCompare(String(b.target_date ?? '9')))
  const active = goals.filter(g => !g.status || g.status === 'active')
  const others = goals.filter(g => g.status && g.status !== 'active')
  return (
    <div className="page">
      <header className="page-head">
        <h1>GOALS</h1>
        <button className="btn primary small" onClick={() => onOpen('goals', undefined, { status: 'active', start_date: today })}>
          + 目標
        </button>
      </header>
      {active.length === 0 && (
        <Empty>
          目標を登録しましょう。「測る指標」に次のように書くと、記録から自動で達成率と到達予想日を計算します。
          <ul className="plain small">
            <li>
              <code>e1rm:back squat</code> … 種目の推定1RM
            </li>
            <li>
              <code>weight</code> / <code>body_fat</code> / <code>muscle</code> / <code>waist</code> … 体組成
            </li>
            <li>
              <code>skill:ring muscle-up</code> … スキルの最大連続回数
            </li>
            <li>
              <code>run:5000</code> … 5km換算タイム (秒)
            </li>
            <li>
              <code>sleep</code> / <code>protein</code> … 睡眠 (時間) ・たんぱく質 (g)
            </li>
          </ul>
        </Empty>
      )}
      {active.map(g => {
        const p = goalProgress(bundle, g, today)
        const ms = g.metric ? metricSeries(bundle, String(g.metric)) : null
        return (
          <Card
            key={g.id}
            title={String(g.title)}
            action={
              <button className="link-btn" onClick={() => onOpen('goals', g)}>
                編集
              </button>
            }
          >
            <div className="goal-top">
              <span className="muted">
                現在 <b className="text">{p.currentLabel}</b> → 目標 <b className="text">{g.target_value != null ? `${g.target_value}${g.unit ?? ''}` : '—'}</b>
                {g.target_date ? ` (${String(g.target_date).replace(/-/g, '/')}まで)` : ''}
              </span>
              <b>{p.pct != null ? `${p.pct}%` : ''}</b>
            </div>
            <Progress pct={p.pct} tone={p.onTrack === false ? 'warn' : 'good'} />
            <p className="small">
              {p.projectedDate
                ? `今のペースなら ${p.projectedDate.replace(/-/g, '/')} ごろ到達見込み${p.onTrack === false ? ' — 期限には間に合わないペースです' : p.onTrack ? ' — 期限に間に合うペースです' : ''}`
                : p.current != null
                  ? '到達予想は、記録が4件以上・3週間分たまると出ます'
                  : p.basis}
            </p>
            {ms && ms.series.length > 1 && (
              <LineChart
                height={130}
                series={[{ name: ms.label, color: 'var(--series-1)', points: ms.series.slice(-120), dots: true }]}
                target={g.target_value != null ? { value: Number(g.target_value), label: '目標' } : undefined}
              />
            )}
            {g.note ? <p className="muted small">{String(g.note)}</p> : null}
            <p className="muted small">{p.basis}</p>
          </Card>
        )
      })}
      {others.length > 0 && (
        <Card title="達成・保留・取り下げ">
          {others.map(g => (
            <button key={g.id} className="entry" onClick={() => onOpen('goals', g)}>
              <span className="tag">{{ achieved: '達成', paused: '保留', dropped: '取り下げ' }[String(g.status)]}</span>
              <span className="entry-title">{String(g.title)}</span>
              {g.achieved_on ? <span className="entry-note">{String(g.achieved_on).replace(/-/g, '/')} 達成</span> : null}
            </button>
          ))}
        </Card>
      )}
    </div>
  )
}
