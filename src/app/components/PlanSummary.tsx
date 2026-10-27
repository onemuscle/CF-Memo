import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { formatMD, shiftDate } from '../../plan/plan'
import { GOAL_LABEL, ENV_LABEL, LEVEL_LABEL } from '../../workout/engine/labels'
import { SectionBlock, SubFold } from '../../components/TodayPage'
import { BackIcon, EditIcon } from '../../components/Icons'
import { DOW_LABEL, WEEK_ORDER, daysText, weightDirection } from '../profile'
import { PHASES, SESSION_META, isTraining, phaseOf, type Plan, type Session } from '../plan/plan'
import { targetsFor, weightAt, weeklyRate } from '../plan/nutrition'
import { PROGRESSION, mealGuide, rulesFor } from '../plan/guide'
import { ThemePicker } from './Onboarding'
import type { Theme } from '../theme'

function accent(color: string): CSSProperties {
  return { '--k': color } as CSSProperties
}

/** 週の型の中で、トレーニング日の代表 (いちばん多いセッション) */
function typicalTraining(plan: Plan): Session | undefined {
  const list = Object.values(plan.template).filter(isTraining)
  const count = new Map<string, number>()
  list.forEach(s => count.set(s.type, (count.get(s.type) ?? 0) + 1))
  return [...list].sort((a, b) => count.get(b.type)! - count.get(a.type)!)[0]
}

/** 週の型 (月〜日) */
export function WeekTemplate({ plan }: { plan: Plan }) {
  return (
    <div className="tpl-week">
      {WEEK_ORDER.map(d => {
        const s = plan.template[d]
        const meta = SESSION_META[s.type]
        return (
          <div key={d} className={`tpl-day ${s.type}`} style={accent(meta.color)}>
            <span className="tpl-dow">{DOW_LABEL[d]}</span>
            <span className="tpl-label">{s.type === 'rest' ? '休' : s.label}</span>
          </div>
        )
      })}
    </div>
  )
}

/** 週ごとのフェーズの帯 */
export function PhaseTimeline({ plan, currentWeek }: { plan: Plan; currentWeek?: number }) {
  const weeks = Array.from({ length: plan.profile.weeks }, (_, i) => i + 1)
  const used = [...new Set(weeks.map(w => phaseOf(w, plan.profile.weeks).key))]
  return (
    <div className="phase-tl">
      <div className="phase-tl-bars">
        {weeks.map(w => {
          const ph = phaseOf(w, plan.profile.weeks)
          return (
            <span key={w} className={`phase-tl-bar ${w === currentWeek ? 'now' : ''}`} style={accent(ph.color)} title={`W${w} ${ph.label}`}>
              {w}
            </span>
          )
        })}
      </div>
      <div className="phase-tl-legend">
        {used.map(k => (
          <span key={k} style={accent(PHASES[k].color)}>
            <i />
            {PHASES[k].label}
          </span>
        ))}
      </div>
    </div>
  )
}

function KeyNumbers({ plan }: { plan: Plan }) {
  const p = plan.profile
  const train = typicalTraining(plan)
  const t = train ? targetsFor(p, train) : undefined
  const rest = targetsFor(p, plan.template[WEEK_ORDER.find(d => !isTraining(plan.template[d])) ?? 0])
  const dir = weightDirection(p.goal)
  const endWeight = weightAt(p, p.weeks)
  return (
    <div className="key-grid">
      {t && (
        <div className="key-cell">
          <span>トレーニング日</span>
          <b>{t.kcal.toLocaleString()}</b>
          <small>kcal</small>
        </div>
      )}
      <div className="key-cell">
        <span>休養日</span>
        <b>{rest.kcal.toLocaleString()}</b>
        <small>kcal</small>
      </div>
      <div className="key-cell">
        <span>タンパク質</span>
        <b>{rest.p}</b>
        <small>g / 日</small>
      </div>
      <div className="key-cell">
        <span>{dir ? `${p.weeks}週後の目安` : '体重'}</span>
        <b>{(dir && weeklyRate(p) !== 0 ? endWeight : p.weight).toFixed(1)}</b>
        <small>{dir && weeklyRate(p) !== 0 ? `kg (今 ${p.weight}kg)` : 'kg (維持)'}</small>
      </div>
    </div>
  )
}

interface Props {
  plan: Plan
  mode: 'ready' | 'overview'
  onStart?: () => void
  onBack?: () => void
  onEdit: () => void
  onReset?: () => void
  /** 色テーマを変える (プランは作り直さない) */
  onTheme?: (t: Theme) => void
}

export default function PlanSummary({ plan, mode, onStart, onBack, onEdit, onReset, onTheme }: Props) {
  const p = plan.profile
  const [confirmReset, setConfirmReset] = useState(false)
  const owner = p.name ? `${p.name}さんの` : 'あなたの'
  const period = `${formatMD(plan.start)} 〜 ${formatMD(plan.end)}`

  return (
    <div className={`page plan-summary ${mode}`}>
      {mode === 'overview' ? (
        <div className="topbar">
          <button className="icon-btn" onClick={onBack} aria-label="戻る">
            <BackIcon size={20} />
          </button>
          <span className="topbar-title">プランとプロフィール</span>
          <span className="icon-btn-spacer" />
        </div>
      ) : (
        <div className="ready-head">
          <span className="ready-badge">PLAN READY</span>
          <h1 className="ready-title">
            {owner}
            <br />
            {p.weeks}週間プランができました
          </h1>
        </div>
      )}

      <section className="sum-card">
        <div className="sum-row">
          <span className="sum-goal">{GOAL_LABEL[p.goal]}</span>
          <span className="sum-period">
            {period} · 週{p.days.length}日 · {p.minutes}分
          </span>
        </div>
        <WeekTemplate plan={plan} />
        <PhaseTimeline plan={plan} />
      </section>

      <KeyNumbers plan={plan} />

      {mode === 'ready' && (
        <ul className="ready-notes">
          <li>毎日のメニューは「今日」タブに表示されます。種目・回数・休憩まで決まっているので、その通りに進めるだけ。</li>
          <li>体調が悪い日は「今日の調子」を変えると、その場でメニューが軽くなります。</li>
          <li>回答はいつでも右上の人型アイコンから直せます。</li>
        </ul>
      )}

      {mode === 'overview' && (
        <>
          <section className="sum-card">
            <h3 className="sum-h">週ごとの進め方</h3>
            <ul className="wk-list">
              {Array.from({ length: p.weeks }, (_, i) => i + 1).map(w => {
                const ph = phaseOf(w, p.weeks)
                const dir = weightDirection(p.goal)
                return (
                  <li key={w} style={accent(ph.color)}>
                    <span className="wk-no">W{w}</span>
                    <span className="wk-date">{formatMD(shiftDate(plan.start, (w - 1) * 7))}〜</span>
                    <span className="wk-phase">{ph.label}</span>
                    {dir && weeklyRate(p) !== 0 && <span className="wk-weight">{weightAt(p, w).toFixed(1)}kg</span>}
                  </li>
                )
              })}
            </ul>
            <SubFold title="フェーズの考え方">
              {(['intro', 'build', 'push', 'deload', 'final'] as const).map(k => (
                <SectionBlock key={k} section={{ title: `${PHASES[k].label} — ${PHASES[k].aim}`, body: [PHASES[k].detail] }} />
              ))}
              <SectionBlock section={PROGRESSION} />
            </SubFold>
          </section>

          <section className="sum-card">
            <h3 className="sum-h">いつでも守るルール</h3>
            <ul className="bullet-list">
              {rulesFor(p).map(r => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <SubFold title="食事の考え方">
              {mealGuide(p).map(s => (
                <SectionBlock key={s.title} section={s} />
              ))}
            </SubFold>
          </section>

          {onTheme && (
            <section className="sum-card">
              <h3 className="sum-h">アプリの色</h3>
              <ThemePicker value={p.theme ?? 'black'} onChange={onTheme} />
            </section>
          )}

          <section className="sum-card">
            <h3 className="sum-h">プロフィール</h3>
            <dl className="pair-list">
              {[
                ['からだ', `${p.age}歳 / ${p.height}cm / ${p.weight}kg`],
                ['経験', LEVEL_LABEL[p.level]],
                ['場所', p.places.map(e => ENV_LABEL[e]).join('・')],
                ['曜日', `週${p.days.length}日 (${daysText(p.days)})`],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      )}

      <div className="today-actions">
        {mode === 'ready' && (
          <button className="btn-primary wide" onClick={onStart}>
            今日のメニューを見る
          </button>
        )}
        <button className={mode === 'ready' ? 'btn-ghost wide' : 'btn-primary wide'} onClick={onEdit}>
          <EditIcon size={17} />
          {mode === 'ready' ? '回答を見直す' : '回答を直してプランを作り直す'}
        </button>
      </div>

      {mode === 'overview' && onReset && (
        <div className="reset-box">
          {confirmReset ? (
            <>
              <p className="card-note">プロフィールを消して最初の質問からやり直します。メモ・PR記録は残ります。</p>
              <div className="reset-actions">
                <button className="btn-ghost" onClick={() => setConfirmReset(false)}>
                  やめる
                </button>
                <button className="btn-danger" onClick={onReset}>
                  最初からやり直す
                </button>
              </div>
            </>
          ) : (
            <button className="reset-link" onClick={() => setConfirmReset(true)}>
              プランを最初から作り直す
            </button>
          )}
        </div>
      )}

      <p className="fine">
        カロリー・PFCは計算式による目安です。持病のある方・妊娠中の方は医師に相談のうえ取り組んでください。データはこの端末のブラウザにだけ保存されます。
      </p>
    </div>
  )
}

/** プラン作成の演出 (計算は一瞬だが、何をしているか見せて納得感を出す) */
export function Generating({ weeks, onDone }: { weeks: number; onDone: () => void }) {
  const steps = ['週のスケジュールを組んでいます', `${weeks}週間の進め方を決めています`, 'カロリーとPFCを計算しています', '今日のメニューを用意しています']
  const [n, setN] = useState(0)
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    const ids = steps.map((_, i) => window.setTimeout(() => setN(i + 1), 380 * (i + 1)))
    ids.push(window.setTimeout(() => done.current(), 380 * steps.length + 450))
    return () => ids.forEach(id => window.clearTimeout(id))
  }, [steps.length])
  return (
    <div className="generating">
      <div className="gen-ring" />
      <ul className="gen-steps">
        {steps.map((s, i) => (
          <li key={s} className={i < n ? 'done' : i === n ? 'now' : ''}>
            {s}
          </li>
        ))}
      </ul>
    </div>
  )
}
