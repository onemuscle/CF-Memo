import { useMemo, useState } from 'react'
import {
  addDays,
  aerobicEfficiency,
  dailyLoad,
  dailyValues,
  dedupeHealth,
  durationLabel,
  liftSummaries,
  movingAverage,
  nutritionByDay,
  paceLabel,
  periodSummary,
  project,
  relations,
  riegel,
  round,
  targetFor,
  todayISO,
  weekStart,
  weeklyRate,
  type Bundle,
  type LiftSummary,
} from '../../../shared/analytics.ts'
import { keyOf } from '../../../shared/schema.ts'
import { BarChart, LineChart } from '../components/Chart.tsx'
import { Card, Empty, Markdown, Segmented, Sheet, Stat } from '../components/ui.tsx'
import type { Row } from '../api.ts'
import { fmtNum, rowsOf, useData } from '../data.tsx'

type Tab = 'strength' | 'endurance' | 'body' | 'recovery' | 'report'

export default function AnalysisPage({ onOpen }: { onOpen: (name: string, row?: Row) => void }) {
  const [tab, setTab] = useState<Tab>('strength')
  const { bundle, range, setRange } = useData()
  if (!bundle) return null
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">ANALYSIS</div>
          <h1>分析</h1>
        </div>
        <button className="link-btn" onClick={() => setRange(range === 'all' ? 'recent' : 'all')}>
          {range === 'all' ? '全期間を表示中' : '直近400日を表示中'}
        </button>
      </header>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          ['strength', '筋力'],
          ['endurance', '持久力'],
          ['body', '体・栄養'],
          ['recovery', '回復'],
          ['report', 'レポート'],
        ]}
      />
      {tab === 'strength' && <Strength b={bundle} />}
      {tab === 'endurance' && <Endurance b={bundle} />}
      {tab === 'body' && <Body b={bundle} />}
      {tab === 'recovery' && <Recovery b={bundle} onOpen={onOpen} />}
      {tab === 'report' && <Reports b={bundle} />}
    </div>
  )
}

// ---------------- 筋力 ----------------

/**
 * 種目間の比率の目安 (一般的なトレーニング文献・コーチングでよく使われる範囲)。
 * 個人差が大きいので「大きく外れていたら確認する」程度に使う。
 */
const RATIOS: { a: string; b: string; lo: number; hi: number; hint: string }[] = [
  { a: 'front squat', b: 'back squat', lo: 0.8, hi: 0.9, hint: '低いなら体幹・上背部の保持力、前傾しすぎ' },
  { a: 'deadlift', b: 'back squat', lo: 1.1, hi: 1.3, hint: '低いなら後ろ側 (ハム・臀部・背中) が弱い' },
  { a: 'strict press', b: 'bench press', lo: 0.6, hi: 0.7, hint: '低いなら肩の筋力・オーバーヘッドの安定性' },
  { a: 'squat clean', b: 'front squat', lo: 0.8, hi: 0.9, hint: '低いなら技術 (引き・ターンオーバー)。高いなら脚力が律速' },
  { a: 'clean & jerk', b: 'back squat', lo: 0.7, hi: 0.8, hint: '低いなら技術かジャークの安定性' },
  { a: 'snatch', b: 'clean & jerk', lo: 0.78, hi: 0.85, hint: '低いならスナッチの技術・オーバーヘッドの可動性' },
  { a: 'push jerk', b: 'push press', lo: 1.05, hi: 1.2, hint: '低いならディップ後の潜り込みの速さ' },
]

function Strength({ b }: { b: Bundle }) {
  const lifts = useMemo(() => liftSummaries(rowsOf(b, 'strength_sets')), [b])
  const [sel, setSel] = useState<string | null>(null)
  const L = lifts.find(l => l.key === sel) ?? lifts[0]
  const bw = dailyValues(rowsOf(b, 'body_metrics'), 'weight_kg').slice(-7)
  const bodyWeight = bw.length ? bw.reduce((a, p) => a + p.value, 0) / bw.length : null
  const best = new Map(lifts.map(l => [l.key, l.bestE1rm]))
  const ratios = RATIOS.map(r => ({ ...r, va: best.get(r.a), vb: best.get(r.b) })).filter(r => r.va && r.vb)
  const skills = useMemo(() => {
    const m = new Map<string, Row>()
    const sorted = [...rowsOf(b, 'skill_logs')].sort((x, y) => String(x.date).localeCompare(String(y.date)))
    const maxUb = new Map<string, number>()
    for (const r of sorted) {
      const k = String(r.skill_key || keyOf(String(r.skill)))
      m.set(k, r)
      if (r.max_unbroken != null) maxUb.set(k, Math.max(maxUb.get(k) ?? 0, Number(r.max_unbroken)))
    }
    return [...m.entries()].map(([k, r]) => ({ k, r, best: maxUb.get(k) }))
  }, [b])

  if (!lifts.length && !skills.length) return <Empty>重量 (筋力セット) を記録すると、推定1RM・自己ベスト・成長予測がここに出ます。</Empty>
  return (
    <>
      {lifts.length > 0 && (
        <>
          <div className="chips scroll">
            {lifts.map(l => (
              <button key={l.key} className={l.key === L.key ? 'chip on' : 'chip'} onClick={() => setSel(l.key)}>
                {l.movement}
              </button>
            ))}
          </div>
          <LiftCard L={L} bodyWeight={bodyWeight} />
        </>
      )}
      {ratios.length > 0 && (
        <Card title="種目間バランス (弱点の手がかり)">
          <table className="table">
            <thead>
              <tr>
                <th>比率</th>
                <th>実測</th>
                <th>目安</th>
              </tr>
            </thead>
            <tbody>
              {ratios.map(r => {
                const v = round(r.va! / r.vb!, 2)
                const off = v < r.lo ? 'low' : v > r.hi ? 'high' : 'ok'
                return (
                  <tr key={r.a + r.b}>
                    <td>
                      {r.a} / {r.b}
                      {off === 'low' && <div className="muted small">{r.hint}</div>}
                    </td>
                    <td className={off === 'ok' ? '' : 'warn-text'}>{v}</td>
                    <td className="muted">
                      {r.lo}〜{r.hi}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="muted small">推定1RMの比較です。測定日が離れている種目同士は参考程度に。</p>
        </Card>
      )}
      <Card title="スキル">
        {skills.length === 0 ? (
          <Empty>Ring Muscle-up などのスキルを記録すると、到達度と最大連続回数の推移がここに出ます</Empty>
        ) : (
          <ul className="skill-list">
            {skills.map(({ k, r, best }) => (
              <li key={k}>
                <b>{String(r.skill)}</b>
                <span className="badge">{{ drill: 'ドリル', first: '初成功', inconsistent: 'たまに', consistent: '安定', wod_ready: 'WOD可' }[String(r.level)] ?? '—'}</span>
                <span className="muted">最大連続 {best ?? '—'}回 ・ {String(r.date).slice(5).replace('-', '/')}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

function LiftCard({ L, bodyWeight }: { L: LiftSummary; bodyWeight: number | null }) {
  const today = todayISO()
  const series = L.daily
  let runBest = -Infinity
  const bestLine = series.map(p => ({ date: p.date, value: (runBest = Math.max(runBest, p.value)) }))
  const proj = project(bestLine.filter(p => p.date >= addDays(today, -365)), [90, 180, 365], today, { saturationDays: 180, capPerYear: 0.1 })
  const band = proj[0].status === 'ok' && bestLine.length ? [{ date: today, low: bestLine[bestLine.length - 1].value, high: bestLine[bestLine.length - 1].value }, ...proj.map(p => ({ date: p.date, low: p.low!, high: p.high! }))] : undefined
  const reps = [1, 2, 3, 5, 8, 10].filter(r => L.repMaxes[r])
  return (
    <Card title={L.movement}>
      <div className="stats">
        <Stat label="推定1RM (最高)" value={L.bestE1rm ?? '—'} unit="kg" sub={L.bestE1rmDate?.replace(/-/g, '/')} />
        <Stat label="最高重量" value={L.heaviest?.weight ?? '—'} unit="kg" sub={L.heaviest ? `${L.heaviest.reps}回 ${L.heaviest.date.slice(5).replace('-', '/')}` : undefined} />
        {bodyWeight && L.bestE1rm && <Stat label="体重比" value={round(L.bestE1rm / bodyWeight, 2)} unit="倍" />}
      </div>
      <LineChart
        series={[
          { name: '推定1RM (日別)', color: 'var(--series-dim)', points: series, dots: true, line: false },
          { name: 'ベスト推移', color: 'var(--series-1)', points: bestLine },
          ...(proj[0].status === 'ok' && bestLine.length
            ? [{ name: '予測', color: 'var(--series-2)', dashed: true, points: [bestLine[bestLine.length - 1], ...proj.map(p => ({ date: p.date, value: p.value! }))] }]
            : []),
        ]}
        band={band}
        fmt={v => `${Math.round(v)}`}
      />
      {reps.length > 0 && (
        <div className="rm-grid">
          {reps.map(r => (
            <div key={r}>
              <span>{r}RM</span>
              <b>{L.repMaxes[r].weight}</b>
            </div>
          ))}
        </div>
      )}
      <h4>成長予測 (推定1RM)</h4>
      <table className="table">
        <tbody>
          {proj.map(p => (
            <tr key={p.horizonDays}>
              <td>{{ 90: '3か月後', 180: '6か月後', 365: '1年後' }[p.horizonDays]}</td>
              {p.status === 'ok' ? (
                <>
                  <td>
                    <b>{p.value}kg</b>
                  </td>
                  <td className="muted">
                    {p.low}〜{p.high}kg
                  </td>
                </>
              ) : (
                <td colSpan={2} className="muted">
                  データ不足: {p.reason}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">
        直近1年のベスト推移の傾きから、伸びが徐々に鈍る前提で推定。幅は約80%の範囲。トレーニング内容・怪我・体重変化で大きく変わります。
        {proj.some(p => p.capped) && ' 最近の伸びが急なため、経験者の現実的な上限 (年+10%) で抑えています。'}
      </p>
    </Card>
  )
}

// ---------------- 持久力 ----------------

function Endurance({ b }: { b: Bundle }) {
  const today = todayISO()
  // Apple Watch と手入力が同じ日・同じ種目にあれば手入力を優先 (二重計上しない)
  const cardio = (dedupeHealth(b).data.cardio_sessions ?? []) as Row[]
  const runs = cardio.filter(c => c.modality === 'run')
  const weeks = Array.from({ length: 12 }, (_, i) => weekStart(addDays(today, -7 * (11 - i))))
  const weekly = weeks.map(w => ({
    label: w.slice(5).replace('-', '/'),
    title: `${w.replace(/-/g, '/')}の週`,
    value: round(runs.filter(r => String(r.date) >= w && String(r.date) <= addDays(w, 6)).reduce((a, r) => a + Number(r.distance_m ?? 0), 0) / 1000, 1),
  }))
  const pace = runs.filter(r => r.pace_s_per_km).map(r => ({ date: String(r.date), value: Number(r.pace_s_per_km) / 60 })).sort((a, z) => a.date.localeCompare(z.date))
  const eff = aerobicEfficiency(cardio)
  const zone2 = weeks.map(w => ({
    label: w.slice(5).replace('-', '/'),
    title: `${w.replace(/-/g, '/')}の週`,
    value: Math.round(cardio.filter(c => String(c.date) >= w && String(c.date) <= addDays(w, 6)).reduce((a, c) => a + Number(c.zone2_min ?? (c.kind === 'easy' ? Number(c.duration_s ?? 0) / 60 : 0)), 0)),
  }))
  const efforts = runs
    .filter(r => String(r.date) >= addDays(today, -120) && Number(r.distance_m) >= 3000 && r.duration_s && ['tempo', 'race', 'test'].includes(String(r.kind)))
    .map(r => ({ r, five: riegel(Number(r.duration_s), Number(r.distance_m), 5000) }))
    .sort((a, z) => a.five - z.five)
  const bestEffort = efforts[0]
  const races = rowsOf(b, 'races').sort((a, z) => String(z.date).localeCompare(String(a.date)))
  return (
    <>
      <Card title="週間ラン距離 (km)">
        <BarChart bars={weekly} fmt={v => `${round(v, 1)}`} />
      </Card>
      <Card title="Zone2・イージーの時間 (分/週)">
        <BarChart bars={zone2} color="var(--series-3)" />
        <p className="muted small">zone2_min が無い記録は「イージー」の運動時間で数えています。</p>
      </Card>
      <Card title="ランのペース (分/km・下ほど速い)">
        <LineChart series={[{ name: 'ペース', color: 'var(--series-1)', points: pace, dots: true }]} fmt={v => paceLabel(v * 60).replace('/km', '')} />
      </Card>
      <Card title="有酸素効率 (同じ心拍でのスピード)">
        <LineChart series={[{ name: '効率', color: 'var(--series-3)', points: eff, dots: true }]} emptyText="イージー/ロング走を心拍付きで記録すると表示されます" />
        <p className="muted small">イージー走の「速度÷平均心拍」。右肩上がりなら心肺機能が伸びています。気温・坂・疲労でぶれるので傾向で見てください。</p>
      </Card>
      <Card title="タイム予測">
        {bestEffort ? (
          <>
            <p className="small">
              基準: {String(bestEffort.r.date).replace(/-/g, '/')} {round(Number(bestEffort.r.distance_m) / 1000, 2)}km {durationLabel(Number(bestEffort.r.duration_s))}
            </p>
            <table className="table">
              <tbody>
                {[
                  ['5km', 5000],
                  ['10km', 10000],
                  ['ハーフ', 21097.5],
                  ['フル', 42195],
                ].map(([l, d]) => (
                  <tr key={l}>
                    <td>{l}</td>
                    <td>
                      <b>{durationLabel(riegel(Number(bestEffort.r.duration_s), Number(bestEffort.r.distance_m), Number(d)))}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted small">Riegel の式による推定。ハーフ・フルは長距離の練習量が少ないと実際より楽観的に出ます (筋量の多い CrossFit 選手は特に)。</p>
          </>
        ) : (
          <Empty>直近120日にテンポ走・レース・タイムトライアル (3km以上) を記録すると予測が出ます</Empty>
        )}
      </Card>
      <Card title="大会">
        {races.length === 0 ? (
          <Empty>HYROX・マラソンなどの大会 (予定・結果) を記録できます</Empty>
        ) : (
          <ul className="race-list">
            {races.map(r => (
              <li key={r.id}>
                <span className="muted">{String(r.date).replace(/-/g, '/')}</span>
                <b>{String(r.name)}</b>
                <span>{r.status === 'planned' ? `予定${r.target_text ? ` (目標 ${r.target_text})` : ''}` : String(r.result_text ?? '')}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

// ---------------- 体・栄養 ----------------

function Body({ b }: { b: Bundle }) {
  const today = todayISO()
  const bm = rowsOf(b, 'body_metrics')
  const weights = dailyValues(bm, 'weight_kg')
  const avg = movingAverage(weights)
  const rate = weeklyRate(avg, today)
  const proj = project(avg.filter(p => p.date >= addDays(today, -56)), [28, 56, 84], today, { minSpanDays: 14 })
  const fat = dailyValues(bm, 'body_fat_pct')
  const muscle = dailyValues(bm, 'muscle_kg')
  const waist = dailyValues(bm, 'waist_cm')
  const nut = nutritionByDay(rowsOf(b, 'nutrition_entries')).filter(d => d.date >= addDays(today, -13))
  const target = targetFor(rowsOf(b, 'nutrition_targets'), today)
  const days14 = Array.from({ length: 14 }, (_, i) => addDays(today, -13 + i))
  const bars = (f: 'kcal' | 'protein_g') =>
    days14.map(d => ({ label: d.slice(8), title: d.replace(/-/g, '/'), value: nut.find(x => x.date === d)?.[f] ?? null }))
  const avgOf = (f: 'kcal' | 'protein_g') => {
    const vs = nut.map(d => d[f]).filter((v): v is number => v != null)
    return vs.length ? Math.round(vs.reduce((a, c) => a + c, 0) / vs.length) : null
  }
  const suggestion = nutritionSuggestion(avg, rate?.perWeek ?? null, target, b, today)
  const sups = rowsOf(b, 'supplements').filter(s => s.active !== 0)
  return (
    <>
      <Card title="体重">
        <div className="stats">
          <Stat label="7日平均" value={avg.length ? avg[avg.length - 1].value.toFixed(1) : '—'} unit="kg" />
          <Stat label="ペース" value={rate ? `${rate.perWeek > 0 ? '+' : ''}${rate.perWeek}` : '—'} unit="kg/週" sub="直近4週" />
        </div>
        <LineChart
          series={[
            { name: '体重', color: 'var(--series-dim)', points: weights.filter(p => p.date >= addDays(today, -180)), dots: true, line: false },
            { name: '7日平均', color: 'var(--series-1)', points: avg.filter(p => p.date >= addDays(today, -180)) },
          ]}
          fmt={v => v.toFixed(1)}
        />
        <table className="table">
          <tbody>
            {proj.map(p => (
              <tr key={p.horizonDays}>
                <td>{p.horizonDays / 7}週後</td>
                {p.status === 'ok' ? (
                  <>
                    <td>
                      <b>{p.value}kg</b>
                    </td>
                    <td className="muted">
                      {p.low}〜{p.high}
                    </td>
                  </>
                ) : (
                  <td colSpan={2} className="muted">
                    データ不足
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">直近8週の7日平均がこのペースで続いた場合。食事・水分・塩分で日々±1kgは普通に動きます。</p>
      </Card>
      <div className="grid-2">
        <Card title="体脂肪率 (%)">
          <LineChart height={130} series={[{ name: '体脂肪率', color: 'var(--series-2)', points: fat, dots: true }]} />
        </Card>
        <Card title="筋肉量 (kg)">
          <LineChart height={130} series={[{ name: '筋肉量', color: 'var(--series-3)', points: muscle, dots: true }]} />
        </Card>
      </div>
      <Card title="腹囲 (cm)">
        <LineChart height={130} series={[{ name: '腹囲', color: 'var(--series-4)', points: waist, dots: true }]} emptyText="週1〜2回、朝のへそ周りを測ると変化が追えます" />
      </Card>
      <Card title="摂取カロリー (14日)" action={target ? <span className="muted small">目標 {fmtNum(Number(target.kcal))}kcal</span> : undefined}>
        <BarChart bars={bars('kcal')} target={target?.kcal ? Number(target.kcal) : undefined} color="var(--series-2)" />
        <p className="muted small">平均 {avgOf('kcal') ?? '—'}kcal ・ 記録 {nut.length}日</p>
      </Card>
      <Card title="たんぱく質 (14日)" action={target?.protein_g ? <span className="muted small">目標 {String(target.protein_g)}g</span> : undefined}>
        <BarChart bars={bars('protein_g')} target={target?.protein_g ? Number(target.protein_g) : undefined} color="var(--series-3)" />
        <p className="muted small">平均 {avgOf('protein_g') ?? '—'}g{avg.length ? ` (体重1kgあたり ${round((avgOf('protein_g') ?? 0) / avg[avg.length - 1].value, 1)}g)` : ''}</p>
      </Card>
      {suggestion && (
        <Card title="摂取目標の見直し">
          <p>{suggestion}</p>
        </Card>
      )}
      <Card title="使用中のサプリメント">
        {sups.length === 0 ? (
          <Empty>サプリメントを登録すると一覧になります</Empty>
        ) : (
          <ul className="plain">
            {sups.map(s => (
              <li key={s.id}>
                <b>{String(s.name)}</b> {String(s.dose ?? '')} <span className="muted">{String(s.timing ?? '')}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

/** 体重の動きから摂取量の調整を提案 (12週プランで決めたルールに沿う) */
function nutritionSuggestion(avg: { date: string; value: number }[], perWeek: number | null, target: Record<string, unknown> | null, b: Bundle, today: string): string | null {
  if (!target || perWeek == null) return null
  const phase = String(target.phase ?? '')
  const fatigue = rowsOf(b, 'wellness')
    .filter(w => String(w.date) >= addDays(today, -7))
    .map(w => Number(w.fatigue))
    .filter(Boolean)
  const tired = fatigue.length >= 3 && fatigue.reduce((a, c) => a + c, 0) / fatigue.length >= 3.5
  const a14 = avg.find(p => p.date >= addDays(today, -14))
  const flat = a14 && avg.length && Math.abs(avg[avg.length - 1].value - a14.value) < 0.2
  if (phase === 'cut') {
    if (perWeek <= -0.8 && tired) return `週${perWeek}kgと落ちるペースが速く、疲労も高めです。1日200〜300kcal (主に炭水化物) 戻すことを検討してください。`
    if (flat) return '2週間、7日平均体重がほぼ動いていません。1日150〜200kcal (炭水化物30〜40g か 脂質10〜15g) 減らすことを検討してください。たんぱく質は削らないでください。'
    return `減量ペースは週${perWeek}kg。目安 (週-0.2〜-0.4kg) に対して${perWeek > -0.2 ? 'ゆっくりめ' : perWeek < -0.5 ? '速め' : '順調'}です。`
  }
  if (phase === 'bulk') {
    if (perWeek < 0.1) return '増量期なのに体重がほぼ増えていません。1日200〜300kcal 足すことを検討してください。'
    if (perWeek > 0.5) return `週+${perWeek}kgは増量としては速めです。脂肪の増えすぎに注意 (腹囲も確認)。`
  }
  return null
}

// ---------------- 回復 ----------------

function Recovery({ b, onOpen }: { b: Bundle; onOpen: (name: string, row?: Row) => void }) {
  const today = todayISO()
  const sleep = dailyValues(rowsOf(b, 'sleep_logs'), 'duration_min').map(p => ({ ...p, value: round(p.value / 60, 2) })).filter(p => p.date >= addDays(today, -90))
  const load = dailyLoad(b)
  const loadBars = Array.from({ length: 28 }, (_, i) => {
    const d = addDays(today, -27 + i)
    return { label: d.slice(8), title: d.replace(/-/g, '/'), value: load.get(d) ?? null }
  })
  const hrv = dailyValues([...rowsOf(b, 'sleep_logs'), ...rowsOf(b, 'daily_health')], 'hrv_ms').filter(p => p.date >= addDays(today, -90))
  const rhr = dailyValues([...rowsOf(b, 'sleep_logs'), ...rowsOf(b, 'daily_health')], 'resting_hr').filter(p => p.date >= addDays(today, -90))
  const rel = relations(b)
  const injuries = rowsOf(b, 'injuries').sort((a, z) => (a.status === 'resolved' ? 1 : 0) - (z.status === 'resolved' ? 1 : 0) || String(z.started_on).localeCompare(String(a.started_on)))
  return (
    <>
      <Card title="睡眠 (時間)">
        <LineChart series={[{ name: '睡眠', color: 'var(--series-dim)', points: sleep, dots: true, line: false }, { name: '7日平均', color: 'var(--series-1)', points: movingAverage(sleep) }]} target={{ value: 7, label: '7h' }} fmt={v => v.toFixed(1)} />
      </Card>
      <Card title="日別のトレーニング負荷 (28日)">
        <BarChart bars={loadBars} color="var(--series-2)" />
        <p className="muted small">負荷 = セッションRPE × 時間(分)。RPE未入力は6として計算。</p>
      </Card>
      {hrv.length > 0 && (
        <Card title="HRV (ms)">
          <LineChart series={[{ name: 'HRV', color: 'var(--series-3)', points: hrv, dots: true }, { name: '7日平均', color: 'var(--series-1)', points: movingAverage(hrv) }]} />
        </Card>
      )}
      {rhr.length > 0 && (
        <Card title="安静時心拍 (bpm)">
          <LineChart series={[{ name: '安静時心拍', color: 'var(--series-4)', points: rhr, dots: true }]} />
        </Card>
      )}
      <Card title="関係性 (相関)">
        <table className="table">
          <tbody>
            {rel.map(r => (
              <tr key={r.label}>
                <td>
                  {r.label}
                  <div className="muted small">{r.note}</div>
                </td>
                <td>
                  <b>{r.n >= 14 && r.r != null ? r.r : '—'}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">-1〜+1。±0.3未満はほぼ関係なし。相関は原因を示すものではありません。</p>
      </Card>
      <Card title="怪我・不調の履歴" action={<button className="link-btn" onClick={() => onOpen('injuries')}>+ 追加</button>}>
        {injuries.length === 0 ? (
          <Empty>記録なし</Empty>
        ) : (
          injuries.map(i => (
            <button key={i.id} className="entry" onClick={() => onOpen('injuries', i)}>
              <span className={`tag ${i.status === 'resolved' ? '' : 'g-recovery'}`}>{{ active: '痛みあり', recovering: '回復中', resolved: '治った', chronic: '慢性' }[String(i.status)] ?? '—'}</span>
              <span className="entry-title">
                {String(i.body_part)} <span className="muted">{String(i.started_on).replace(/-/g, '/')}〜{i.resolved_on ? String(i.resolved_on).replace(/-/g, '/') : ''}</span>
              </span>
              {i.description ? <span className="entry-note">{String(i.description)}</span> : null}
            </button>
          ))
        )}
      </Card>
    </>
  )
}

// ---------------- レポート ----------------

function Reports({ b }: { b: Bundle }) {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('week')
  const [offset, setOffset] = useState(0)
  const [open, setOpen] = useState<Row | null>(null)
  const today = todayISO()
  let from: string
  let to: string
  if (period === 'week') {
    from = addDays(weekStart(today), -7 * offset)
    to = addDays(from, 6)
  } else if (period === 'month') {
    const d = new Date()
    const s = new Date(d.getFullYear(), d.getMonth() - offset, 1)
    const e = new Date(d.getFullYear(), d.getMonth() - offset + 1, 0)
    from = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-01`
    to = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`
  } else {
    const y = new Date().getFullYear() - offset
    from = `${y}-01-01`
    to = `${y}-12-31`
  }
  const s = periodSummary(b, from, to)
  const saved = rowsOf(b, 'reports').sort((a, z) => String(z.end_date).localeCompare(String(a.end_date)))
  const TYPE: Record<string, string> = { crossfit: 'CrossFit', strength: '筋力', accessory: '補助', cardio: '有酸素', hyrox: 'HYROX', skill: 'スキル', mobility: 'モビリティ', other: 'その他' }
  return (
    <>
      <Segmented
        value={period}
        onChange={p => {
          setPeriod(p)
          setOffset(0)
        }}
        options={[
          ['week', '週'],
          ['month', '月'],
          ['year', '年'],
        ]}
      />
      <div className="period-nav">
        <button className="icon-btn" onClick={() => setOffset(o => o + 1)} aria-label="前へ">
          ‹
        </button>
        <b>
          {from.replace(/-/g, '/')} 〜 {to.replace(/-/g, '/')}
        </b>
        <button className="icon-btn" onClick={() => setOffset(o => Math.max(0, o - 1))} disabled={offset === 0} aria-label="次へ">
          ›
        </button>
      </div>
      <Card title="集計">
        <div className="stats">
          <Stat label="セッション" value={s.sessions} unit="回" />
          <Stat label="運動時間" value={fmtNum(s.trainingMin)} unit="分" />
          <Stat label="負荷" value={fmtNum(s.load)} />
          <Stat label="平均睡眠" value={s.avgSleepMin ? `${Math.floor(s.avgSleepMin / 60)}h${String(s.avgSleepMin % 60).padStart(2, '0')}` : '—'} sub={`${s.sleepNights}日分`} />
          <Stat label="平均体重" value={s.avgWeight ?? '—'} unit="kg" sub={s.weightChange != null ? `期間内 ${s.weightChange > 0 ? '+' : ''}${s.weightChange}kg` : undefined} />
          <Stat label="平均摂取" value={s.avgKcal ? fmtNum(s.avgKcal) : '—'} unit="kcal" sub={s.avgProtein ? `P ${s.avgProtein}g ・ ${s.nutritionDays}日分` : undefined} />
        </div>
        {Object.keys(s.sessionsByType).length > 0 && (
          <p className="small">
            内訳:{' '}
            {Object.entries(s.sessionsByType)
              .map(([k, v]) => `${TYPE[k] ?? k} ${v}`)
              .join(' / ')}
            {Object.keys(s.cardioKm).length > 0 && ` ・ 距離: ${Object.entries(s.cardioKm).map(([k, v]) => `${k} ${v}km`).join(' / ')}`}
          </p>
        )}
        {s.prs.length > 0 && (
          <>
            <h4>自己ベスト更新 ({s.prs.length})</h4>
            <ul className="plain">
              {s.prs.map((p, i) => (
                <li key={i}>
                  {p.date.slice(5).replace('-', '/')} {p.movement} {p.kind === 'e1rm' ? `推定1RM ${p.value}kg` : `${p.reps}RM ${p.value}kg`}
                </li>
              ))}
            </ul>
          </>
        )}
        {s.activeInjuries.length > 0 && <p className="warn-text small">継続中の不調: {s.activeInjuries.join('、')}</p>}
      </Card>
      <Card title="コーチのレポート (Claude Code が作成)">
        {saved.length === 0 ? (
          <Empty>Claude Code に「今週のレポートを作って」と頼むと、分析レポートがここに保存されます。</Empty>
        ) : (
          saved.map(r => (
            <button key={r.id} className="entry" onClick={() => setOpen(r)}>
              <span className="tag">{{ week: '週次', month: '月次', year: '年間', custom: '任意' }[String(r.period)]}</span>
              <span className="entry-title">{String(r.title)}</span>
              <span className="entry-note">
                {String(r.start_date).replace(/-/g, '/')}〜{String(r.end_date).replace(/-/g, '/')}
              </span>
            </button>
          ))
        )}
      </Card>
      {open && (
        <Sheet title={String(open.title)} onClose={() => setOpen(null)}>
          <Markdown text={String(open.body_md ?? '')} />
        </Sheet>
      )}
    </>
  )
}
