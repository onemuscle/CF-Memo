import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { getSetting, getWod, putSetting } from '../db'
import type { ScannedWod } from '../types'
import {
  HOME_EQUIPMENT,
  MEALS,
  TOP_RULES,
  type Exercise,
  type GymLocation,
  type PlanDay,
} from '../plan/planData'
import {
  AIM_JA,
  BURPEE_PACING,
  BURPEE_PACING_NOTE,
  EXERCISE_JA,
  MEAL_GUIDE,
  SESSION_GUIDE,
  SKIP_RULE,
  SKIP_RULE_NOTE,
  glossFor,
  type GuideSection,
} from '../plan/guideData'
import {
  AM_COLOR,
  GYM_LABEL,
  GYM_SETTING,
  MEAL_COLOR,
  SESSION_META,
  exercisesFor,
  gymLocationOf,
  locationMatters,
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
import AdviceCard from './AdviceCard'
import { BackIcon, ChevronIcon, EditIcon, ListIcon } from './Icons'

interface Props {
  onWriteMemo: (day: PlanDay) => void
  onOpenPlan: () => void
}

/** スキャン保存時に「今日」タブを更新するための合図 */
export const WOD_SAVED_EVENT = 'cf-wod-saved'

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

// ---------------------------------------------------------------- スキャンしたWOD

/** その日にスキャンしたWODを引く。保存直後にも追従できるようイベントも待つ */
function useScannedWod(date: string): ScannedWod | undefined {
  const [wod, setWod] = useState<ScannedWod>()

  useEffect(() => {
    let alive = true
    const load = () => {
      getWod(date).then(w => {
        if (alive) setWod(w)
      })
    }
    load()
    window.addEventListener(WOD_SAVED_EVENT, load)
    return () => {
      alive = false
      window.removeEventListener(WOD_SAVED_EVENT, load)
    }
  }, [date])

  return wod
}

function ScannedWodBody({ wod }: { wod: ScannedWod }) {
  const hasDetail = wod.movements.length > 0
  return (
    <>
      {wod.format && <p className="wod-format">{wod.format}</p>}

      {hasDetail ? (
        <div className="wod-movements">
          {wod.movements.map((m, i) => (
            <div className="wod-move" key={`${m.name}-${i}`}>
              <span className="wod-move-name">
                {m.name}
                {m.nameJa && <span className="wod-move-ja">{m.nameJa}</span>}
              </span>
              <span className="wod-move-rx">
                {[m.reps, m.load].filter(Boolean).join(' / ')}
              </span>
            </div>
          ))}
        </div>
      ) : (
        wod.raw && <pre className="wod-raw">{wod.raw}</pre>
      )}

      {wod.notes && <p className="card-note">{wod.notes}</p>}

      {wod.result && (
        <p className="wod-result">
          <strong>記録</strong>
          {wod.result}
        </p>
      )}

      <p className="card-note">
        ここが高負荷なら、この後のRun・Burpeeは中止する。
        {wod.confidence !== 'high' && wod.source === 'claude' && (
          <> 読み取りにあいまいな箇所があります。原本の写真も確認してください。</>
        )}
        {wod.source === 'tesseract' && <> 端末内OCRの結果です。誤りが多い場合があります。</>}
      </p>
    </>
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
  const wod = useScannedWod(day.date)

  return (
    <>
      {/* WODは非同期で届く。Card の開閉は初期値で決まるので key で作り直す */}
      <Card
        key={wod ? `wod-${wod.updatedAt}` : 'plan'}
        color={AM_COLOR}
        tag="WOD"
        title={wod?.title || day.am}
        defaultOpen={!!wod}
      >
        {wod ? (
          <ScannedWodBody wod={wod} />
        ) : (
          day.kind !== 'review' && (
            <p className="card-note">
              ボックスのWOD。ここが高負荷なら、この後のRun・Burpeeは中止する。
              スキャンタブでホワイトボードを撮ると、この欄にその日のWODが入ります。
            </p>
          )
        )}
      </Card>

      {/* 朝のWODを読み取った日は、その内容を踏まえた判定を予定の上に出す */}
      <Card
        key={wod?.advice ? `pm-${wod.updatedAt}` : 'pm'}
        color={meta.color}
        tag="補助"
        title={day.pm}
        defaultOpen
      >
        {wod?.advice && wod.advice.forDate === day.date && (
          <AdviceCard advice={wod.advice} />
        )}
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
        <SubFold title="2つ目のセッションを中止する判断">
          <SectionBlock section={SKIP_RULE} />
          <SectionBlock section={SKIP_RULE_NOTE} />
        </SubFold>
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

/** タイトル中の英語に日本語訳を添える */
export function GlossRow({ text }: { text: string }) {
  const terms = glossFor(text)
  if (!terms.length) return null
  return (
    <span className="gloss-row">
      {terms.map(t => (
        <span key={t.term} className="gloss">
          <b>{t.term}</b>
          {t.ja}
        </span>
      ))}
    </span>
  )
}

/** 解説ブロック (見出し + 段落 + 箇条書き + ラベル対) */
export function SectionBlock({ section }: { section: GuideSection }) {
  return (
    <div className="guide-section">
      <h4 className="guide-title">{section.title}</h4>
      {section.body?.map(p => (
        <p key={p} className="guide-text">
          {p}
        </p>
      ))}
      {section.bullets && (
        <ul className="bullet-list">
          {section.bullets.map(b => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      {section.pairs && (
        <dl className="pair-list">
          {section.pairs.map(p => (
            <div key={p.label}>
              <dt>{p.label}</dt>
              <dd>{p.detail}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

/** カードの中で開く二段目の折りたたみ */
export function SubFold({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`subfold ${open ? 'open' : ''}`}>
      <button className="subfold-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span>{title}</span>
        <i className={`plan-caret ${open ? 'open' : ''}`}>
          <ChevronIcon size={16} />
        </i>
      </button>
      {open && <div className="subfold-body">{children}</div>}
    </div>
  )
}

/** 「重WODなら中止」のような中止条件か、「RIR1-3」のような単なる指針かを見分ける */
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
  time?: string
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
        {time && <span className="plan-time">{time}</span>}
        <h3 className="plan-title">
          {title}
          <GlossRow text={title} />
        </h3>
        <i className={`plan-caret ${open ? 'open' : ''}`}>
          <ChevronIcon size={18} />
        </i>
      </button>
      {open && <div className="plan-card-body">{children}</div>}
    </section>
  )
}

// ---------------------------------------------------------------- PM 詳細

/** 補助トレの場所 (Jexer / 家ジム)。選択はIndexedDBに保存して次回も引き継ぐ */
function useGymLocation(): [GymLocation, (l: GymLocation) => void] {
  const [location, setLocation] = useState<GymLocation>('jexer')
  useEffect(() => {
    getSetting(GYM_SETTING).then(v => setLocation(gymLocationOf(v)))
  }, [])
  const update = (l: GymLocation) => {
    setLocation(l)
    putSetting(GYM_SETTING, l)
  }
  return [location, update]
}

function PmDetail({ day }: { day: PlanDay }) {
  const week = weekPlan(day.week)
  const guide = SESSION_GUIDE[day.kind]
  const [location, setLocation] = useGymLocation()
  const switchable = locationMatters(day.kind)
  const exercises = exercisesFor(day.kind, switchable ? location : 'jexer')

  return (
    <>
      <p className="guide-aim">{guide.aim}</p>

      {day.kind === 'easyrun' && week && (
        <div className="metric-row">
          <Metric label="EASY / STRIDE" value={week.easy} />
          <Metric label="BURPEE" value={week.burpee} />
        </div>
      )}

      {day.kind === 'quality' && week && (
        <div className="metric-row">
          <Metric label={`WEEK ${week.week} メニュー`} value={week.quality} wide />
        </div>
      )}

      {switchable && (
        <div className="gym-toggle" role="group" aria-label="補助トレの場所">
          {(['jexer', 'home'] as const).map(l => (
            <button
              key={l}
              className={location === l ? 'on' : ''}
              onClick={() => setLocation(l)}
            >
              {GYM_LABEL[l]}
            </button>
          ))}
        </div>
      )}

      {exercises && <ExerciseList items={exercises} />}

      {switchable && location === 'home' && (
        <p className="card-note">
          家ジム版: {HOME_EQUIPMENT}だけでJexer版と同じ狙いになるよう置き換えています。
        </p>
      )}

      <SubFold title="詳しい解説">
        {guide.sections.map(s => (
          <SectionBlock key={s.title} section={s} />
        ))}
        {day.kind === 'quality' && (
          <>
            <SectionBlock section={BURPEE_PACING} />
            <p className="guide-text">{BURPEE_PACING_NOTE}</p>
          </>
        )}
      </SubFold>
    </>
  )
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
            <span className="ex-name">
              {e.name}
              {EXERCISE_JA[e.name] && <i className="ex-name-ja">{EXERCISE_JA[e.name]}</i>}
            </span>
            {volumeOf(e) && <span className="ex-volume">{volumeOf(e)}</span>}
          </div>
          <div className="ex-meta">
            <span className="ex-chip">{e.intensity}</span>
            <span className="ex-aim">{AIM_JA[e.aim] ?? e.aim}</span>
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

      <SubFold title="食事の考え方">
        {MEAL_GUIDE.map(s => (
          <SectionBlock key={s.title} section={s} />
        ))}
      </SubFold>
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
