import { useState, type CSSProperties, type ReactNode } from 'react'
import {
  EXERCISES,
  MEALS,
  TOP_RULES,
  type Exercise,
  type PlanDay,
} from '../plan/planData'
import {
  AM_COLOR,
  MEAL_COLOR,
  SESSION_META,
  TOTAL_DAYS,
  clampToPlan,
  dayIndex,
  dowOf,
  formatMD,
  mealKeys,
  planDay,
  shiftDate,
  todayISO,
  weekDates,
  weekPlan,
  FIRST_DATE,
  LAST_DATE,
} from '../plan/plan'
import { BackIcon, ChevronIcon, EditIcon, ListIcon } from './Icons'

interface Props {
  onWriteMemo: (day: PlanDay) => void
  onOpenPlan: () => void
}

/** CSS 変数 --k にセッション色を渡す */
function accent(color: string): CSSProperties {
  return { '--k': color } as CSSProperties
}

export default function TodayPage({ onWriteMemo, onOpenPlan }: Props) {
  const realToday = todayISO()
  const [date, setDate] = useState(() => clampToPlan(realToday))

  const day = planDay(date)
  const isToday = date === realToday
  const outside = !planDay(realToday)

  return (
    <div className="page today-page">
      <DayNav
        date={date}
        isToday={isToday}
        onMove={n => setDate(d => clampToPlan(shiftDate(d, n)))}
        onToday={() => setDate(clampToPlan(realToday))}
      />

      {day && <Hero day={day} isToday={isToday} />}

      <WeekStrip date={date} today={realToday} onPick={setDate} />

      {outside && (
        <p className="plan-outside">
          今日はプラン期間外です（{formatMD(FIRST_DATE)}〜{formatMD(LAST_DATE)}）。
        </p>
      )}

      {day && <DayBody day={day} onWriteMemo={onWriteMemo} onOpenPlan={onOpenPlan} />}
    </div>
  )
}

// ---------------------------------------------------------------- 日付ナビ

function DayNav({
  date,
  isToday,
  onMove,
  onToday,
}: {
  date: string
  isToday: boolean
  onMove: (n: number) => void
  onToday: () => void
}) {
  return (
    <div className="day-nav">
      <button
        className="icon-btn"
        onClick={() => onMove(-1)}
        disabled={date <= FIRST_DATE}
        aria-label="前の日"
      >
        <BackIcon size={20} />
      </button>
      <div className="day-nav-center">
        <span className="day-nav-date">
          {formatMD(date)}
          <i>({dowOf(date)})</i>
        </span>
        {!isToday && (
          <button className="day-nav-today" onClick={onToday}>
            今日へ戻る
          </button>
        )}
      </div>
      <button
        className="icon-btn"
        onClick={() => onMove(1)}
        disabled={date >= LAST_DATE}
        aria-label="次の日"
      >
        <ChevronIcon size={20} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- ヒーロー

function Hero({ day, isToday }: { day: PlanDay; isToday: boolean }) {
  const meta = SESSION_META[day.kind]
  const week = weekPlan(day.week)
  const idx = Math.min(dayIndex(day.date), TOTAL_DAYS)
  const pct = Math.round((idx / TOTAL_DAYS) * 100)

  return (
    <section className="hero" style={accent(meta.color)}>
      <div className="hero-top">
        <span className="hero-week">
          {day.kind === 'review' ? 'FINAL' : `WEEK ${day.week}`}
          <i>{day.kind === 'review' ? '' : ' / 12'}</i>
        </span>
        <span className="hero-phase">{day.phase}</span>
        {isToday && <span className="hero-today">TODAY</span>}
      </div>

      <h2 className="hero-title">{meta.label}</h2>

      <div className="hero-bar">
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="hero-meta">
        <span>
          {idx}日目 / {TOTAL_DAYS}日
        </span>
        {week && <span>目安体重 {week.targetWeight.toFixed(2)}kg</span>}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- 週ストリップ

function WeekStrip({
  date,
  today,
  onPick,
}: {
  date: string
  today: string
  onPick: (d: string) => void
}) {
  return (
    <div className="week-strip">
      {weekDates(date).map(d => {
        const pd = planDay(d)
        const color = pd ? SESSION_META[pd.kind].color : 'transparent'
        return (
          <button
            key={d}
            className={`strip-day ${d === date ? 'on' : ''} ${pd ? '' : 'off'}`}
            style={accent(color)}
            onClick={() => pd && onPick(d)}
            disabled={!pd}
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
  day,
  onWriteMemo,
  onOpenPlan,
}: {
  day: PlanDay
  onWriteMemo: (day: PlanDay) => void
  onOpenPlan: () => void
}) {
  const meta = SESSION_META[day.kind]

  return (
    <>
      <Card color={AM_COLOR} tag="AM" time="朝" title={day.am}>
        {day.kind !== 'review' && (
          <p className="card-note">
            ボックスのWOD。ここが高負荷なら夜のRun・Burpeeは中止する。
          </p>
        )}
      </Card>

      <Card color={meta.color} tag="PM" time="夜" title={day.pm} defaultOpen>
        <PmDetail day={day} />
      </Card>

      {day.note && (
        <p className={`plan-alert ${isCaution(day.note) ? '' : 'soft'}`}>
          <strong>{isCaution(day.note) ? '注意' : 'ポイント'}</strong>
          {day.note}
        </p>
      )}

      {/* 食事パターンが変わる日をまたいだら選択タブを引き継がない */}
      <MealCard key={day.meal} day={day} />

      <Card color="#8b90a0" tag="RULE" time="共通" title="最優先ルール">
        <ul className="bullet-list">
          {TOP_RULES.map(r => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Card>

      <div className="today-actions">
        <button className="btn-primary wide" onClick={() => onWriteMemo(day)}>
          <EditIcon size={17} />
          この日のメモを書く
        </button>
        <button className="btn-ghost wide" onClick={onOpenPlan}>
          <ListIcon size={17} />
          プラン全体を見る
        </button>
      </div>
    </>
  )
}

/** 「重WODなら夜中止」のような中止条件か、「RIR1-3」のような単なる指針かを見分ける */
function isCaution(note: string): boolean {
  return /中止|省略|削除/.test(note)
}

/** 開閉できるカード。中身がある時だけ開閉ボタンを出す */
function Card({
  color,
  tag,
  time,
  title,
  defaultOpen = false,
  children,
}: {
  color: string
  tag: string
  time: string
  title: string
  defaultOpen?: boolean
  children?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="plan-card" style={accent(color)}>
      <button
        className="plan-card-head"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="plan-tag">{tag}</span>
        <span className="plan-time">{time}</span>
        <h3 className="plan-title">{title}</h3>
        <i className={`plan-caret ${open ? 'open' : ''}`}>
          <ChevronIcon size={18} />
        </i>
      </button>
      {open && <div className="plan-card-body">{children}</div>}
    </section>
  )
}

// ---------------------------------------------------------------- PM 詳細

function PmDetail({ day }: { day: PlanDay }) {
  const week = weekPlan(day.week)

  switch (day.kind) {
    case 'shoulder':
    case 'back':
    case 'optional':
      return <ExerciseList items={EXERCISES[day.kind]} />

    case 'easyrun':
      return (
        <>
          {week && (
            <div className="metric-row">
              <Metric label="EASY / STRIDE" value={week.easy} />
              <Metric label="BURPEE" value={week.burpee} />
            </div>
          )}
          <ExerciseList items={EXERCISES.easyrun} />
        </>
      )

    case 'quality':
      return (
        <>
          {week && (
            <div className="metric-row">
              <Metric label={`WEEK ${week.week} メニュー`} value={week.quality} wide />
            </div>
          )}
          <ExerciseList items={EXERCISES.quality} />
        </>
      )

    case 'restday':
      return (
        <p className="card-note">
          金曜は完全レスト。散歩と軽いMobilityだけにして、睡眠を最優先にする。
        </p>
      )

    case 'weekend':
      return (
        <p className="card-note">
          追加トレはなし。土日どちらもCrossFitに行くなら、土曜のBodymake補助を削る。
        </p>
      )

    case 'review':
      return (
        <p className="card-note">
          体重(7日平均)・腹囲・同条件の写真・WOD出力・Run/Burpeeの失速を記録して、次の12週を組み直す。
        </p>
      )
  }
}

function Metric({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`metric ${wide ? 'wide' : ''}`}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </div>
  )
}

/** Run系は「週進行 / 別表参照」なので、週メニュー側に任せて数字は出さない */
function volumeOf(e: Exercise): string | null {
  if (e.reps === '別表参照') return null
  if (e.sets === '週進行') return e.reps
  return `${e.sets}×${e.reps}`
}

export function ExerciseList({ items }: { items: Exercise[] }) {
  return (
    <ul className="ex-list">
      {items.map(e => (
        <li key={e.name} className="ex-item">
          <div className="ex-top">
            <span className="ex-name">{e.name}</span>
            {volumeOf(e) && <span className="ex-volume">{volumeOf(e)}</span>}
          </div>
          <div className="ex-meta">
            <span className="ex-chip">{e.intensity}</span>
            <span className="ex-aim">{e.aim}</span>
          </div>
          {(e.caution || e.memo) && (
            <p className="ex-note">
              {[e.memo, e.caution && `調整: ${e.caution}`].filter(Boolean).join(' / ')}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------- 食事

function MealCard({ day }: { day: PlanDay }) {
  const keys = mealKeys(day.meal).filter(k => MEALS[k])
  const [active, setActive] = useState(keys[0] ?? '食A')
  const pattern = MEALS[active] ?? MEALS['食A']

  return (
    <Card
      color={MEAL_COLOR}
      tag={keys.length > 1 ? keys.join(' / ') : active}
      time={pattern.target}
      title={pattern.total.kcal ?? ''}
      defaultOpen
    >
      {keys.length > 1 && (
        <div className="chip-row meal-tabs">
          {keys.map(k => (
            <button
              key={k}
              className={`chip ${k === active ? 'chip-on meal-on' : ''}`}
              onClick={() => setActive(k)}
            >
              {k}
            </button>
          ))}
        </div>
      )}

      <div className="pfc-row">
        <Pfc label="P" value={pattern.total.p} />
        <Pfc label="C" value={pattern.total.c} />
        <Pfc label="F" value={pattern.total.f} />
      </div>

      <MealTimeline pattern={active} />

      {pattern.total.point && <p className="card-note">{pattern.total.point}</p>}
    </Card>
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

export function MealTimeline({ pattern }: { pattern: string }) {
  const items = MEALS[pattern]?.items ?? []
  return (
    <ol className="meal-list">
      {items.map(m => (
        <li key={m.time} className="meal-item">
          <span className="meal-time">{m.time}</span>
          <div className="meal-body">
            <p className="meal-food">{m.food}</p>
            <p className="meal-macro">
              P {m.p} · C {m.c} · F {m.f}
            </p>
            {m.point && <p className="meal-point">{m.point}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}
