import { addDays, dailyValues, goalProgress, loadStatus, movingAverage, nutritionByDay, periodSummary, prEvents, readiness, targetFor, todayISO, weekStart, weeklyRate } from '../../../shared/analytics.ts'
import { ENTITIES, entity, type EntityDef } from '../../../shared/schema.ts'
import type { Row } from '../api.ts'
import { LineChart } from '../components/Chart.tsx'
import Icon from '../components/Icon.tsx'
import { Card, Empty, Progress, Ring, Stat } from '../components/ui.tsx'
import { fmtNum, rowTitle, rowsOf, useData } from '../data.tsx'

const LEVEL: Record<string, { label: string; color: string; text: string }> = {
  push: { label: '攻めてOK', color: 'var(--good)', text: '高強度・PR狙いに向いた日' },
  normal: { label: '通常どおり', color: 'var(--accent)', text: '予定どおりでOK' },
  easy: { label: '控えめに', color: 'var(--warning)', text: '量か強度のどちらかを落とす' },
  rest: { label: '回復優先', color: 'var(--critical)', text: '休養・軽い有酸素・モビリティ' },
  unknown: { label: '未入力', color: 'var(--muted)', text: '睡眠かコンディションを記録すると判定します' },
}

const QUICK: { name: string; label: string }[] = [
  { name: 'workouts', label: 'WOD' },
  { name: 'strength_sets', label: '重量' },
  { name: 'body_metrics', label: '体重' },
  { name: 'sleep_logs', label: '睡眠' },
]

const DOW = '日月火水木金土'

export default function Dashboard({
  onOpen,
  onAdd,
  onGo,
}: {
  onOpen: (name: string, row?: Row) => void
  onAdd: () => void
  onGo: (tab: 'analysis' | 'goals' | 'log') => void
}) {
  const { bundle } = useData()
  const today = todayISO()
  if (!bundle) return null

  const rd = readiness(bundle, today)
  const lv = LEVEL[rd.level]
  const ws = weekStart(today)
  const week = periodSummary(bundle, ws, addDays(ws, 6))
  const ls = loadStatus(bundle, today)
  const weights = dailyValues(rowsOf(bundle, 'body_metrics'), 'weight_kg').filter(p => p.date >= addDays(today, -90))
  const avg = movingAverage(weights)
  const rate = weeklyRate(avg, today)
  const prs = prEvents(rowsOf(bundle, 'strength_sets'), addDays(today, -30), today).slice(-4).reverse()
  const goals = rowsOf(bundle, 'goals')
    .filter(g => g.status === 'active' || !g.status)
    .sort((a, b) => Number(a.priority ?? 9) - Number(b.priority ?? 9))
    .slice(0, 3)
  const races = rowsOf(bundle, 'races')
    .filter(r => r.status === 'planned' && String(r.date) >= today)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const todayNut = nutritionByDay(rowsOf(bundle, 'nutrition_entries')).find(d => d.date === today)
  const target = targetFor(rowsOf(bundle, 'nutrition_targets'), today)
  const todays: { name: string; row: Row }[] = []
  for (const d of Object.values(ENTITIES) as unknown as EntityDef[]) {
    if (!d.dateField || d.name === 'reports' || d.name === 'goals' || d.name === 'nutrition_targets') continue
    for (const r of rowsOf(bundle, d.name)) if (r[d.dateField] === today) todays.push({ name: d.name, row: r })
  }
  const [, m, dd] = today.split('-')
  const dow = DOW[new Date(today + 'T00:00:00').getDay()]

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">
            {Number(m)}月{Number(dd)}日 ({dow})
          </div>
          <h1>今日</h1>
        </div>
      </header>

      <Card className="readiness">
        <div className="readiness-main">
          <Ring value={rd.score} label="READY" color={lv.color} />
          <div className="readiness-body">
            <div className="readiness-level" style={{ color: lv.color }}>
              {lv.label}
            </div>
            <p className="readiness-text">{lv.text}</p>
          </div>
        </div>
        {rd.components.length > 0 && (
          <div className="pills">
            {rd.components.map(c => (
              <span key={c.label} className="pill">
                {c.label.replace(/ \(.*\)/, '')} <b>{c.value.replace(/ \(.*\)/, '')}</b>
              </span>
            ))}
          </div>
        )}
        {rd.advice.length > 0 && (
          <ul className="advice">
            {rd.advice.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        )}
        {rd.level === 'unknown' && (
          <div className="row-actions">
            <button className="btn small" onClick={() => onOpen('sleep_logs')}>
              睡眠を記録
            </button>
            <button className="btn small" onClick={() => onOpen('wellness')}>
              コンディションを記録
            </button>
          </div>
        )}
      </Card>

      <div className="quick-row">
        {QUICK.map(q => (
          <button key={q.name} className={`quick g-${entity(q.name)!.group}`} onClick={() => onOpen(q.name)}>
            <Icon name={q.name} size={24} />
            <span>{q.label}</span>
          </button>
        ))}
        <button className="quick more" onClick={onAdd}>
          <Icon name="plus" size={24} />
          <span>ほか</span>
        </button>
      </div>

      <Card title="今日の記録" action={todays.length ? <button className="link-btn" onClick={() => onGo('log')}>履歴へ</button> : undefined}>
        {todays.length === 0 ? (
          <Empty>
            まだ記録がありません。
            <br />
            下の <b>＋</b> から記録できます。
          </Empty>
        ) : (
          <ul className="today-list">
            {todays.map(({ name, row }) => (
              <li key={row.id}>
                <button onClick={() => onOpen(name, row)}>
                  <span className={`entry-icon g-${entity(name)!.group}`}>
                    <Icon name={name} size={18} />
                  </span>
                  <span className="entry-title">{rowTitle(name, row)}</span>
                  <Icon name="chevron" size={16} className="muted" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="今週" action={<span className="muted small">{Number(ws.slice(5, 7))}/{Number(ws.slice(8))}〜</span>}>
        <div className="stats">
          <Stat label="セッション" value={week.sessions} unit="回" />
          <Stat label="運動時間" value={fmtNum(week.trainingMin)} unit="分" />
          <Stat label="平均睡眠" value={week.avgSleepMin ? `${Math.floor(week.avgSleepMin / 60)}:${String(week.avgSleepMin % 60).padStart(2, '0')}` : '—'} tone={week.avgSleepMin && week.avgSleepMin < 420 ? 'warn' : undefined} />
        </div>
        <div className="divider" />
        <div className="load-row">
          <div>
            <div className="stat-label">トレーニング負荷 (直近7日 ÷ 普段)</div>
            <div className="load-value">
              {ls.acwr ?? '—'}
              <span className={`zone ${ls.zone}`}>{{ unknown: 'データ不足', low: '少なめ', optimal: '適正', high: '高め', very_high: '急増' }[ls.zone]}</span>
            </div>
          </div>
          <span className="muted small">0.8〜1.3 が目安</span>
        </div>
      </Card>

      {(todayNut || target) && (
        <Card title="今日の栄養">
          <div className="macro-grid">
            {(
              [
                ['カロリー', todayNut?.kcal, target?.kcal, 'kcal'],
                ['P', todayNut?.protein_g, target?.protein_g, 'g'],
                ['F', todayNut?.fat_g, target?.fat_g, 'g'],
                ['C', todayNut?.carbs_g, target?.carbs_g, 'g'],
              ] as [string, number | null | undefined, unknown, string][]
            ).map(([label, v, t, unit]) => {
              const goal = t != null ? Number(t) : null
              const pct = v != null && goal ? Math.round((v / goal) * 100) : null
              return (
                <div key={label} className="macro">
                  <div className="stat-label">{label}</div>
                  <div className="macro-value">
                    {v != null ? fmtNum(v) : '—'}
                    <small>
                      {goal ? ` / ${fmtNum(goal)}` : ''}
                      {unit}
                    </small>
                  </div>
                  <Progress pct={pct} tone={pct != null && pct > 110 ? 'warn' : 'good'} />
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Card title="目標" action={<button className="link-btn" onClick={() => onGo('goals')}>すべて</button>}>
        {goals.length === 0 ? (
          <Empty>目標を登録すると、達成率と到達予想日がここに出ます</Empty>
        ) : (
          goals.map(g => {
            const p = goalProgress(bundle, g, today)
            return (
              <div className="goal-row" key={g.id}>
                <div className="goal-top">
                  <span>{String(g.title)}</span>
                  <b>{p.pct != null ? `${p.pct}%` : '—'}</b>
                </div>
                <Progress pct={p.pct} tone={p.onTrack === false ? 'warn' : 'good'} />
                <div className="muted small">
                  現在 {p.currentLabel}
                  {p.projectedDate ? ` ・ 到達予想 ${p.projectedDate.replace(/-/g, '/')}` : ''}
                </div>
              </div>
            )
          })
        )}
      </Card>

      {prs.length > 0 && (
        <Card title="最近の自己ベスト">
          <ul className="pr-list">
            {prs.map((p, i) => (
              <li key={i}>
                <span className="pr-date">{p.date.slice(5).replace('-', '/')}</span>
                <span className="pr-name">{p.movement}</span>
                <b>{p.kind === 'e1rm' ? `推定1RM ${p.value}kg` : `${p.reps}RM ${p.value}kg`}</b>
                {p.previous != null && <span className="delta">+{Math.round((p.value - p.previous) * 10) / 10}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="体重 (90日)" action={<button className="link-btn" onClick={() => onGo('analysis')}>分析へ</button>}>
        <LineChart
          height={150}
          series={[
            { name: '体重', color: 'var(--series-dim)', points: weights, dots: true, line: false },
            { name: '7日平均', color: 'var(--series-1)', points: avg },
          ]}
          fmt={v => v.toFixed(1)}
          emptyText="体重を記録すると推移が出ます (体重計をヘルスケアに連携すると自動)"
        />
        {rate && (
          <p className="muted small">
            直近4週のペース: 週 {rate.perWeek > 0 ? '+' : ''}
            {rate.perWeek}kg
          </p>
        )}
      </Card>

      {races.length > 0 && (
        <Card title="次の大会">
          {races.slice(0, 2).map(r => (
            <div key={r.id} className="race-row">
              <b>{String(r.name)}</b>
              <span>{String(r.date).replace(/-/g, '/')}</span>
              <span className="muted">あと{Math.round((Date.parse(String(r.date)) - Date.parse(today)) / 86400000)}日</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
