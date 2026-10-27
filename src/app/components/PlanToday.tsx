import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { getWod } from '../../db'
import type { ScannedWod } from '../../types'
import { diffDays, dowOf, formatMD, shiftDate, todayISO, weekDates } from '../../plan/plan'
import { SectionBlock, SubFold, WOD_SAVED_EVENT, WodPhoto, isPhotoWod } from '../../components/TodayPage'
import type { MemoDraft } from '../../components/MemoEditor'
import { BackIcon, ChevronIcon, EditIcon, ListIcon } from '../../components/Icons'
import { CONDITION_LABEL } from '../../workout/engine/labels'
import { weightDirection } from '../profile'
import {
  SESSION_META,
  clampToPlan,
  dayPlan,
  isTraining,
  sessionTitle,
  type DayPlan,
  type Plan,
} from '../plan/plan'
import { dayWorkout, type DayCondition, type DayWorkout } from '../plan/workout'
import { SWAP_TABLE, dayMeals, targetsFor, weightAt, weeklyRate } from '../plan/nutrition'
import { CONDITION_HELP, PROGRESSION, REST_TIPS, mealGuide, rulesFor } from '../plan/guide'

interface Props {
  plan: Plan
  onWriteMemo: (draft: MemoDraft) => void
  onOpenPlan: () => void
  onNewPlan: () => void
}

const MEAL_COLOR = 'var(--c-orange)'

function accent(color: string): CSSProperties {
  return { '--k': color } as CSSProperties
}

// ---------------------------------------------------------------- その日の調子・メニューの入れ替え (端末に保存)

interface DayPref {
  cond: DayCondition
  variant: number
}

const PREF_KEY = (date: string) => `fitmemo:day:${date}`

function loadPref(date: string): DayPref {
  try {
    const raw = localStorage.getItem(PREF_KEY(date))
    if (raw) return { cond: 'auto', variant: 0, ...(JSON.parse(raw) as Partial<DayPref>) }
  } catch {
    // 保存できない環境でも既定値で動く
  }
  return { cond: 'auto', variant: 0 }
}

function savePref(date: string, pref: DayPref) {
  try {
    if (pref.cond === 'auto' && pref.variant === 0) localStorage.removeItem(PREF_KEY(date))
    else localStorage.setItem(PREF_KEY(date), JSON.stringify(pref))
  } catch {
    // 保存できなくても続行する
  }
}

function useDayPref(date: string): [DayPref, (p: DayPref) => void] {
  const [pref, setPref] = useState<DayPref>(() => loadPref(date))
  useEffect(() => setPref(loadPref(date)), [date])
  const update = (p: DayPref) => {
    setPref(p)
    savePref(date, p)
  }
  return [pref, update]
}

/** その日にスキャンしたWOD (CrossFit のクラスのWOD) */
function useScannedWod(date: string): ScannedWod | undefined {
  const [wod, setWod] = useState<ScannedWod>()
  useEffect(() => {
    let alive = true
    const load = () => getWod(date).then(w => alive && setWod(w))
    load()
    window.addEventListener(WOD_SAVED_EVENT, load)
    return () => {
      alive = false
      window.removeEventListener(WOD_SAVED_EVENT, load)
    }
  }, [date])
  return wod
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 4) return 'こんばんは'
  if (h < 11) return 'おはようございます'
  if (h < 18) return 'こんにちは'
  return 'こんばんは'
}

// ---------------------------------------------------------------- 画面

export default function PlanToday({ plan, onWriteMemo, onOpenPlan, onNewPlan }: Props) {
  const realToday = todayISO()
  const [date, setDate] = useState(() => clampToPlan(plan, realToday))
  // プランを作り直したら表示中の日付を期間内に戻す
  useEffect(() => setDate(clampToPlan(plan, todayISO())), [plan])

  const day = dayPlan(plan, date)
  const isToday = date === realToday
  const p = plan.profile
  const untilStart = diffDays(realToday, plan.start)
  const finished = realToday > plan.review

  return (
    <div className="page today-page">
      <p className="greet">
        {greeting()}
        {p.name && `、${p.name}さん`}
      </p>

      {untilStart > 0 && (
        <div className="countdown" style={accent('var(--c-cyan)')}>
          <b>{untilStart}</b>
          <span>
            日後 ({formatMD(plan.start)}) からプラン開始。
            <br />
            それまでは1日目のメニューを予習できます。
          </span>
        </div>
      )}

      {finished && (
        <div className="countdown done" style={accent('var(--c-yellow)')}>
          <span>
            {p.weeks}週間のプランが終わりました。お疲れさまでした!
            <br />
            今の体重や記録で、次のプランを作りましょう。
          </span>
          <button className="btn-primary" onClick={onNewPlan}>
            次のプランへ
          </button>
        </div>
      )}

      <DayNav
        date={date}
        isToday={isToday}
        canPrev={date > plan.start}
        canNext={date < plan.review}
        onMove={n => setDate(d => clampToPlan(plan, shiftDate(d, n)))}
        onToday={() => setDate(clampToPlan(plan, realToday))}
        showToday={!isToday && realToday >= plan.start && realToday <= plan.review}
      />

      {day && <Hero plan={plan} day={day} isToday={isToday} />}

      <WeekStrip plan={plan} date={date} today={realToday} onPick={setDate} />

      {day && <DayBody key={date} plan={plan} day={day} onWriteMemo={onWriteMemo} onOpenPlan={onOpenPlan} onNewPlan={onNewPlan} />}
    </div>
  )
}

function DayNav({
  date,
  isToday,
  canPrev,
  canNext,
  showToday,
  onMove,
  onToday,
}: {
  date: string
  isToday: boolean
  canPrev: boolean
  canNext: boolean
  showToday: boolean
  onMove: (n: number) => void
  onToday: () => void
}) {
  return (
    <div className="day-nav">
      <button className="icon-btn" onClick={() => onMove(-1)} disabled={!canPrev} aria-label="前の日">
        <BackIcon size={20} />
      </button>
      <div className="day-nav-center">
        <span className="day-nav-date">
          {formatMD(date)}
          <i>({dowOf(date)})</i>
        </span>
        {showToday && !isToday && (
          <button className="day-nav-today" onClick={onToday}>
            今日へ戻る
          </button>
        )}
      </div>
      <button className="icon-btn" onClick={() => onMove(1)} disabled={!canNext} aria-label="次の日">
        <ChevronIcon size={20} />
      </button>
    </div>
  )
}

function Hero({ plan, day, isToday }: { plan: Plan; day: DayPlan; isToday: boolean }) {
  const meta = SESSION_META[day.session.type]
  const p = plan.profile
  const review = day.session.type === 'review'
  const idx = Math.min(day.index, plan.totalDays)
  const pct = Math.round((idx / plan.totalDays) * 100)
  const showWeight = weightDirection(p.goal) && weeklyRate(p) !== 0

  return (
    <section className="hero" style={accent(meta.color)}>
      <div className="hero-top">
        <span className="hero-week">
          {review ? 'FINAL' : `WEEK ${day.week}`}
          <i>{review ? '' : ` / ${p.weeks}`}</i>
        </span>
        {!review && (
          <span className="hero-phase" style={accent(day.phase.color)}>
            {day.phase.label}
          </span>
        )}
        {isToday && <span className="hero-today">TODAY</span>}
      </div>
      <h2 className="hero-title">{sessionTitle(day.session)}</h2>
      {!review && <p className="hero-aim">{day.phase.aim}</p>}
      <div className="hero-bar">
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="hero-meta">
        <span>
          {idx}日目 / {plan.totalDays}日
        </span>
        {showWeight && <span>今週の目安体重 {weightAt(p, Math.min(day.week, p.weeks)).toFixed(1)}kg</span>}
      </div>
    </section>
  )
}

function WeekStrip({ plan, date, today, onPick }: { plan: Plan; date: string; today: string; onPick: (d: string) => void }) {
  return (
    <div className="week-strip">
      {weekDates(date).map(d => {
        const dp = dayPlan(plan, d)
        const color = dp ? SESSION_META[dp.session.type].color : 'transparent'
        const rest = dp && !isTraining(dp.session)
        return (
          <button
            key={d}
            className={`strip-day ${d === date ? 'on' : ''} ${dp ? '' : 'off'} ${rest ? 'rest' : ''}`}
            style={accent(color)}
            onClick={() => dp && onPick(d)}
            disabled={!dp}
            aria-label={dp ? `${formatMD(d)} ${sessionTitle(dp.session)}` : undefined}
          >
            <span className="strip-dow">{dowOf(d)}</span>
            <span className="strip-num">{Number(d.slice(8))}</span>
            <i className="strip-dot" />
            {d === today && <i className="strip-today" />}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- 本体

function DayBody({
  plan,
  day,
  onWriteMemo,
  onOpenPlan,
  onNewPlan,
}: {
  plan: Plan
  day: DayPlan
  onWriteMemo: (draft: MemoDraft) => void
  onOpenPlan: () => void
  onNewPlan: () => void
}) {
  const p = plan.profile
  const [pref, setPref] = useDayPref(day.date)
  const workout = useMemo(() => dayWorkout(plan, day, pref.cond, pref.variant), [plan, day, pref.cond, pref.variant])
  const wod = useScannedWod(day.date)
  const training = isTraining(day.session)
  const meta = SESSION_META[day.session.type]

  return (
    <>
      {training && (
        <ConditionPicker value={pref.cond} onChange={cond => setPref({ ...pref, cond })} />
      )}

      {wod && <ScannedWodCard wod={wod} classWod={day.session.type === 'crossfit'} />}

      {workout && (
        <WorkoutCard
          color={meta.color}
          tag={meta.tag}
          workout={workout}
          crossfit={day.session.type === 'crossfit'}
          hasClassWod={day.session.type === 'crossfit' && !!wod}
          onReroll={() => setPref({ ...pref, variant: pref.variant + 1 })}
          rerolled={pref.variant > 0}
          onResetVariant={() => setPref({ ...pref, variant: 0 })}
        />
      )}

      {day.session.type === 'rest' && <RestCard plan={plan} day={day} />}
      {day.session.type === 'review' && <ReviewCard plan={plan} onNewPlan={onNewPlan} />}

      <MealCard plan={plan} day={day} />

      <Card color="var(--c-gray)" tag="RULE" title="いつでも守るルール">
        <ul className="bullet-list">
          {rulesFor(p).map(r => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <SubFold title="「今日の調子」と記録の伸ばし方">
          <SectionBlock section={CONDITION_HELP} />
          <SectionBlock section={PROGRESSION} />
        </SubFold>
      </Card>

      <div className="today-actions">
        <button className="btn-primary wide" onClick={() => onWriteMemo(memoDraft(plan, day, workout))}>
          <EditIcon size={17} />
          {training ? 'やった内容をメモする' : 'この日のメモを書く'}
        </button>
        <button className="btn-ghost wide" onClick={onOpenPlan}>
          <ListIcon size={17} />
          プラン全体を見る
        </button>
      </div>
    </>
  )
}

const CONDITIONS: { value: DayCondition; label: string; emoji: string }[] = [
  { value: 'auto', label: 'おまかせ', emoji: '✨' },
  { value: 'great', label: CONDITION_LABEL.great, emoji: '💪' },
  { value: 'normal', label: CONDITION_LABEL.normal, emoji: '🙂' },
  { value: 'tired', label: CONDITION_LABEL.tired, emoji: '😮‍💨' },
]

function ConditionPicker({ value, onChange }: { value: DayCondition; onChange: (c: DayCondition) => void }) {
  return (
    <div className="cond">
      <span className="cond-label">今日の調子</span>
      <div className="cond-row" role="radiogroup" aria-label="今日の調子">
        {CONDITIONS.map(c => (
          <button
            key={c.value}
            role="radio"
            aria-checked={value === c.value}
            className={value === c.value ? 'on' : ''}
            onClick={() => onChange(c.value)}
          >
            <span>{c.emoji}</span>
            {c.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** 開閉できるカード */
function Card({
  color,
  tag,
  time,
  title,
  sub,
  defaultOpen = false,
  children,
}: {
  color: string
  tag: string
  time?: string
  title: string
  sub?: string
  defaultOpen?: boolean
  children?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="plan-card" style={accent(color)}>
      <button className="plan-card-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="plan-tag">{tag}</span>
        {time && <span className="plan-time">{time}</span>}
        <h3 className="plan-title">
          {title}
          {sub && <span className="plan-sub">{sub}</span>}
        </h3>
        <i className={`plan-caret ${open ? 'open' : ''}`}>
          <ChevronIcon size={18} />
        </i>
      </button>
      {open && <div className="plan-card-body">{children}</div>}
    </section>
  )
}

function WorkoutCard({
  color,
  tag,
  workout,
  crossfit,
  hasClassWod,
  rerolled,
  onReroll,
  onResetVariant,
}: {
  color: string
  tag: string
  workout: DayWorkout
  crossfit: boolean
  hasClassWod: boolean
  rerolled: boolean
  onReroll: () => void
  onResetVariant: () => void
}) {
  return (
    <Card
      color={color}
      tag={crossfit && hasClassWod ? 'オープンジム用' : tag}
      time={`約${workout.totalMinutes}分`}
      title={workout.title}
      sub={workout.subtitle}
      defaultOpen={!hasClassWod}
    >
      {crossfit && !hasClassWod && (
        <p className="card-note">
          クラスに出る日は、クラスのWODを優先してください。スキャンタブでホワイトボードを撮ると、この上に表示されます。
        </p>
      )}

      {workout.blocks.map(b => (
        <section key={b.key} className="pw-block">
          <div className="pw-block-head">
            <span className="pw-block-label">{b.label}</span>
            <span className="pw-block-title">{b.title}</span>
            <span className="pw-block-min">{b.minutes}分</span>
          </div>
          {b.format && <p className="pw-format">{b.format}</p>}
          <ul className="pw-items">
            {b.items.map((it, i) => (
              <li key={`${it.id}-${i}`} className="pw-item">
                <div className="pw-item-top">
                  <span className="pw-item-name">
                    {it.tag && <i className="pw-tag">{it.tag}</i>}
                    {it.name}
                    {it.en && <i className="pw-item-en">{it.en}</i>}
                  </span>
                  <span className="pw-rx">{it.prescription}</span>
                </div>
                {it.detail && <p className="pw-item-detail">{it.detail}</p>}
              </li>
            ))}
          </ul>
          {b.tips && b.tips.length > 0 && <p className="pw-format">{b.tips.join(' / ')}</p>}
        </section>
      ))}

      {workout.cautions.length > 0 && (
        <p className="plan-alert">
          <strong>注意</strong>
          {workout.cautions.join(' / ')}
        </p>
      )}

      <SubFold title="なぜこのメニュー?">
        <ul className="bullet-list">
          {[...workout.why, ...workout.next].map(t => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </SubFold>

      <div className="wo-actions">
        {workout.share && (
          <a className="btn-primary wo-start" href={`../workout/?w=${workout.share}`} target="_blank" rel="noreferrer">
            ▶ タイマー付きで始める
          </a>
        )}
        <button className="btn-ghost" onClick={onReroll}>
          別のメニューにする
        </button>
        {rerolled && (
          <button className="wo-reset" onClick={onResetVariant}>
            元のメニューに戻す
          </button>
        )}
      </div>
    </Card>
  )
}

function ScannedWodCard({ wod, classWod }: { wod: ScannedWod; classWod: boolean }) {
  const photoOnly = isPhotoWod(wod)
  return (
    <Card color="var(--c-lime)" tag={classWod ? 'クラスのWOD' : '記録したWOD'} title={wod.title || 'WOD'} sub={wod.format} defaultOpen>
      {photoOnly && <WodPhoto wod={wod} />}
      {wod.movements.length > 0 ? (
        <div className="wod-movements">
          {wod.movements.map((m, i) => (
            <div className="wod-move" key={`${m.name}-${i}`}>
              <span className="wod-move-name">
                {m.name}
                {m.nameJa && <span className="wod-move-ja">{m.nameJa}</span>}
              </span>
              <span className="wod-move-rx">{[m.reps, m.load].filter(Boolean).join(' / ')}</span>
            </div>
          ))}
        </div>
      ) : (
        wod.raw && (photoOnly ? <p className="card-note">{wod.raw}</p> : <pre className="wod-raw">{wod.raw}</pre>)
      )}
      {wod.notes && <p className="card-note">{wod.notes}</p>}
      {wod.result && (
        <p className="wod-result">
          <strong>記録</strong>
          {wod.result}
        </p>
      )}
      {!photoOnly && <WodPhoto wod={wod} />}
    </Card>
  )
}

function RestCard({ plan, day }: { plan: Plan; day: DayPlan }) {
  // 次のトレーニング日を探す
  let next: DayPlan | undefined
  for (let i = 1; i <= 7; i++) {
    const d = dayPlan(plan, shiftDate(day.date, i))
    if (d && isTraining(d.session)) {
      next = d
      break
    }
  }
  return (
    <Card color={SESSION_META.rest.color} tag="REST" title="今日は休んで回復する日" defaultOpen>
      <ul className="bullet-list">
        {REST_TIPS.map(t => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      {next && (
        <p className="next-up" style={accent(SESSION_META[next.session.type].color)}>
          <span>次のトレーニング</span>
          <b>
            {formatMD(next.date)} ({next.dow}) {sessionTitle(next.session)}
          </b>
        </p>
      )}
    </Card>
  )
}

function ReviewCard({ plan, onNewPlan }: { plan: Plan; onNewPlan: () => void }) {
  const p = plan.profile
  return (
    <Card color={SESSION_META.review.color} tag="REVIEW" title={`${p.weeks}週間の振り返り`} defaultOpen>
      <ul className="bullet-list">
        <li>朝いちばんに体重を測る (スタート時 {p.weight}kg)</li>
        <li>PR記録タブで、主な種目の記録がどれだけ伸びたか見てみる</li>
        <li>スタート時と同じ場所・同じ光で写真を撮っておく</li>
        <li>続けられた曜日・続かなかった曜日を振り返る。次のプランの曜日選びに活かす</li>
      </ul>
      <button className="btn-primary wide" onClick={onNewPlan}>
        今の体重で次のプランを作る
      </button>
    </Card>
  )
}

function MealCard({ plan, day }: { plan: Plan; day: DayPlan }) {
  const p = plan.profile
  const t = targetsFor(p, day.session)
  const meals = dayMeals(p, day.session, t)
  const training = isTraining(day.session)

  return (
    <Card color={MEAL_COLOR} tag="MEAL" time={training ? 'トレーニング日' : '休養日'} title={`${t.kcal.toLocaleString()} kcal`} defaultOpen>
      <div className="pfc-row">
        <Pfc label="P" value={`${t.p}g`} />
        <Pfc label="F" value={`${t.f}g`} />
        <Pfc label="C" value={`${t.c}g`} />
      </div>

      <ol className="meal-list">
        {[
          ...meals.slots.map(m => ({
            time: m.time,
            node: (
              <li key={m.time} className={`meal-item ${m.role ?? ''}`}>
                <span className="meal-time">{m.time}</span>
                <div className="meal-body">
                  <p className="meal-food">
                    {m.name}
                    {m.role && <i className="meal-role">{m.role === 'pre' ? 'トレ前' : 'トレ後'}</i>}
                  </p>
                  <p className="meal-macro">
                    P {m.p}g · F {m.f}g · C {m.c}g
                  </p>
                  <p className="meal-point">例: {m.example}</p>
                  {m.tip && <p className="meal-point">{m.tip}</p>}
                </div>
              </li>
            ),
          })),
          ...(meals.trainAt ? [{ time: meals.trainAt, node: <TrainRow key="train" at={meals.trainAt} minutes={p.minutes} /> }] : []),
        ]
          .sort((a, b) => a.time.localeCompare(b.time))
          .map(r => r.node)}
      </ol>

      {meals.preTip && <p className="card-note">💡 {meals.preTip}</p>}

      <SubFold title="食材の置き換え早見表">
        {SWAP_TABLE.map(s => (
          <SectionBlock key={s.label} section={{ title: s.label, bullets: s.items }} />
        ))}
      </SubFold>
      <SubFold title="食事の考え方">
        {mealGuide(p).map(s => (
          <SectionBlock key={s.title} section={s} />
        ))}
      </SubFold>
    </Card>
  )
}

function TrainRow({ at, minutes }: { at: string; minutes: number }) {
  return (
    <li className="meal-item train">
      <span className="meal-time">{at}</span>
      <div className="meal-body">
        <p className="meal-food">🏋️ トレーニング (約{minutes}分)</p>
      </div>
    </li>
  )
}

function Pfc({ label, value }: { label: string; value: string }) {
  return (
    <div className="pfc">
      <span className="pfc-label">{label}</span>
      <span className="pfc-value">{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------- メモの下書き

function memoDraft(plan: Plan, day: DayPlan, w: DayWorkout | null): MemoDraft {
  const head = `W${Math.min(day.week, plan.profile.weeks)} ${day.phase.label} / ${formatMD(day.date)} (${day.dow})`
  const t = targetsFor(plan.profile, day.session)
  const lines = [head, '']
  if (w) {
    lines.push(`${w.title} — ${w.subtitle}`, '')
    for (const b of w.blocks) {
      lines.push(`■ ${b.title} (${b.minutes}分)`)
      for (const it of b.items) lines.push(`・${it.tag ? `${it.tag} ` : ''}${it.name} ${it.prescription}`)
      lines.push('')
    }
    lines.push('【やった内容・重量】', '', '【きつさ・体調】', '')
  }
  lines.push(`食事の目安: ${t.kcal}kcal (P${t.p} / F${t.f} / C${t.c})`)
  return {
    category: w ? 'wod' : 'rest',
    title: `${formatMD(day.date)} ${sessionTitle(day.session)}`,
    body: lines.join('\n').trim(),
    tags: ['プラン', `W${Math.min(day.week, plan.profile.weeks)}`],
  }
}
