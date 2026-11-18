import { addDays, goalProgress, loadStatus, movingAverage, dailyValues, periodSummary, prEvents, readiness, todayISO, weekStart, weeklyRate, nutritionByDay, targetFor } from '../../../shared/analytics.ts'
import { LineChart } from '../components/Chart.tsx'
import { Card, Empty, Progress, Ring, Stat } from '../components/ui.tsx'
import { fmtNum, rowsOf, useData } from '../data.tsx'
import type { QuickKind } from './LogPage.tsx'

const LEVEL: Record<string, { label: string; color: string; text: string }> = {
  push: { label: '攻めてOK', color: 'var(--good)', text: '高強度・PR狙いに向いた日' },
  normal: { label: '通常', color: 'var(--accent)', text: '予定どおりでOK' },
  easy: { label: '控えめに', color: 'var(--warning)', text: 'ボリュームか強度のどちらかを落とす' },
  rest: { label: '回復優先', color: 'var(--critical)', text: '休養・軽い有酸素・モビリティ' },
  unknown: { label: '未入力', color: 'var(--muted)', text: '睡眠かコンディションを記録すると表示' },
}

export const QUICK: { kind: QuickKind; label: string; icon: string }[] = [
  { kind: 'workouts', label: 'WOD', icon: '🔥' },
  { kind: 'strength_sets', label: '重量', icon: '🏋️' },
  { kind: 'cardio_sessions', label: '有酸素', icon: '🏃' },
  { kind: 'body_metrics', label: '体重', icon: '⚖️' },
  { kind: 'nutrition_entries', label: '食事', icon: '🍚' },
  { kind: 'sleep_logs', label: '睡眠', icon: '🌙' },
  { kind: 'wellness', label: '体調', icon: '🩺' },
  { kind: 'skill_logs', label: 'スキル', icon: '🤸' },
]

export default function Dashboard({ onQuick, onGo }: { onQuick: (k: QuickKind) => void; onGo: (tab: 'analysis' | 'goals') => void }) {
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
  const prs = prEvents(rowsOf(bundle, 'strength_sets'), addDays(today, -30), today).slice(-5).reverse()
  const goals = rowsOf(bundle, 'goals')
    .filter(g => g.status === 'active' || !g.status)
    .sort((a, b) => Number(a.priority ?? 9) - Number(b.priority ?? 9))
    .slice(0, 3)
  const races = rowsOf(bundle, 'races')
    .filter(r => r.status === 'planned' && String(r.date) >= today)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const todayNut = nutritionByDay(rowsOf(bundle, 'nutrition_entries')).find(d => d.date === today)
  const target = targetFor(rowsOf(bundle, 'nutrition_targets'), today)

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">{today.replace(/-/g, '.')}</div>
          <h1>TODAY</h1>
        </div>
      </header>

      <Card className="readiness">
        <div className="readiness-main">
          <Ring value={rd.score} label="READY" color={lv.color} />
          <div>
            <div className="badge" style={{ color: lv.color, borderColor: lv.color }}>
              {lv.label}
            </div>
            <p className="readiness-text">{lv.text}</p>
            <div className="mini-comps">
              {rd.components.map(c => (
                <span key={c.label}>
                  {c.label} <b>{c.value}</b>
                </span>
              ))}
            </div>
          </div>
        </div>
        {rd.advice.length > 0 && (
          <ul className="advice">
            {rd.advice.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        )}
        <p className="muted small">参考指標です。痛み・発熱など体の異変があるときは数値より体の声を優先してください。</p>
      </Card>

      <div className="quick-grid">
        {QUICK.map(q => (
          <button key={q.kind} className="quick" onClick={() => onQuick(q.kind)}>
            <span className="quick-icon" aria-hidden>
              {q.icon}
            </span>
            {q.label}
          </button>
        ))}
      </div>

      <Card title="今週" action={<span className="muted small">{ws.slice(5).replace('-', '/')}〜</span>}>
        <div className="stats">
          <Stat label="セッション" value={week.sessions} unit="回" />
          <Stat label="運動時間" value={fmtNum(week.trainingMin)} unit="分" />
          <Stat label="負荷" value={fmtNum(week.load)} sub="RPE×分" />
          <Stat label="平均睡眠" value={week.avgSleepMin ? `${Math.floor(week.avgSleepMin / 60)}h${String(week.avgSleepMin % 60).padStart(2, '0')}` : '—'} tone={week.avgSleepMin && week.avgSleepMin < 420 ? 'warn' : undefined} />
        </div>
      </Card>

      <Card title="トレーニング負荷" action={<span className={`zone ${ls.zone}`}>{{ unknown: 'データ不足', low: '少なめ', optimal: '適正', high: '高め', very_high: '急増' }[ls.zone]}</span>}>
        <div className="stats">
          <Stat label="直近7日" value={fmtNum(ls.acute7)} />
          <Stat label="週平均 (28日)" value={fmtNum(ls.chronic28)} />
          <Stat label="負荷比" value={ls.acwr ?? '—'} tone={ls.acwr && ls.acwr > 1.5 ? 'bad' : ls.acwr && ls.acwr > 1.3 ? 'warn' : undefined} sub="0.8〜1.3が目安" />
        </div>
      </Card>

      {(todayNut || target) && (
        <Card title="今日の栄養">
          <div className="stats">
            <Stat label="カロリー" value={todayNut?.kcal != null ? fmtNum(todayNut.kcal) : '—'} sub={target?.kcal ? `目標 ${fmtNum(Number(target.kcal))}` : undefined} />
            <Stat label="P" value={todayNut?.protein_g ?? '—'} unit="g" sub={target?.protein_g ? `目標 ${target.protein_g}g` : undefined} />
            <Stat label="F" value={todayNut?.fat_g ?? '—'} unit="g" sub={target?.fat_g ? `目標 ${target.fat_g}g` : undefined} />
            <Stat label="C" value={todayNut?.carbs_g ?? '—'} unit="g" sub={target?.carbs_g ? `目標 ${target.carbs_g}g` : undefined} />
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
                <span>{p.movement}</span>
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
          emptyText="体重を記録するとここに推移が出ます"
        />
        {rate && <p className="muted small">直近4週のペース: 週 {rate.perWeek > 0 ? '+' : ''}{rate.perWeek}kg</p>}
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
