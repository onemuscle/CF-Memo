import { useState, type ReactNode } from 'react'
import {
  ADJUST_RULES,
  EXERCISES,
  GOAL_BAND,
  PLAN_PERIOD,
  PLAN_PURPOSE,
  REVIEW_CHECKS,
  REVIEW_HEAD,
  START_STATS,
  START_WEIGHT,
  TOP_RULES,
  WEEKLY_CHECKS,
  WEEKS,
} from '../plan/planData'
import {
  BURPEE_PACING,
  BURPEE_PACING_NOTE,
  GLOSSARY,
  LOAD_BALANCE,
  MEAL_GUIDE,
  METRICS,
  PHILOSOPHY,
  ROLES,
  SKIP_RULE,
  SKIP_RULE_NOTE,
  TARGET_PHYSIQUE,
  WEEK_SHAPE,
  WEIGHT_RULE,
  WHY_HARD,
} from '../plan/guideData'
import { planDay, todayISO } from '../plan/plan'
import { BackIcon, ChevronIcon } from './Icons'
import { ExerciseList, MealTimeline, SectionBlock } from './TodayPage'

const MEAL_KEYS = ['食A', '食B', '食C']
const BODYMAKE: { key: 'shoulder' | 'back' | 'optional'; label: string }[] = [
  { key: 'shoulder', label: '月｜肩・三頭・腹' },
  { key: 'back', label: '水｜背中・二頭・腹' },
  { key: 'optional', label: '土｜上半身 Optional' },
]

export default function PlanOverview({ onBack }: { onBack: () => void }) {
  const currentWeek = planDay(todayISO())?.week

  return (
    <div className="page">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="戻る">
          <BackIcon />
        </button>
        <span className="topbar-title">プラン全体</span>
        <span className="icon-btn-spacer" />
      </div>

      <section className="overview-head">
        <h2 className="detail-title">12週間プラン</h2>
        <p className="overview-period">{PLAN_PERIOD}</p>
        <div className="overview-stats">
          <div>
            <span className="ov-label">開始</span>
            <span className="ov-value">{START_WEIGHT}kg</span>
          </div>
          <div>
            <span className="ov-label">12週後の目標</span>
            <span className="ov-value">{GOAL_BAND}</span>
          </div>
        </div>
        <p className="card-note">{START_STATS}</p>
      </section>

      <Fold title="設計思想">
        <SectionBlock section={PHILOSOPHY} />
        <SectionBlock section={WEEK_SHAPE} />
        <SectionBlock section={ROLES} />
        <SectionBlock section={LOAD_BALANCE} />
        <SectionBlock section={TARGET_PHYSIQUE} />
      </Fold>

      <Fold title="中止・交換の判断">
        <SectionBlock section={SKIP_RULE} />
        <SectionBlock section={SKIP_RULE_NOTE} />
        <SectionBlock section={WHY_HARD} />
        <SectionBlock section={BURPEE_PACING} />
        <p className="guide-text">{BURPEE_PACING_NOTE}</p>
      </Fold>

      <Fold title="進捗の見かた">
        <SectionBlock section={METRICS} />
        <SectionBlock section={WEIGHT_RULE} />
      </Fold>

      <Fold title="週ごとの進行" defaultOpen>
        <ul className="week-list">
          {WEEKS.map(w => (
            <li key={w.week} className={`week-row ${w.week === currentWeek ? 'now' : ''}`}>
              <div className="week-row-top">
                <span className="week-no">W{w.week}</span>
                <span className="week-period">{w.period}</span>
                <span className="week-phase">{w.phase}</span>
                <span className="week-target">{w.targetWeight.toFixed(2)}kg</span>
              </div>
              <dl className="week-detail">
                <div>
                  <dt>火 Easy</dt>
                  <dd>{w.easy}</dd>
                </div>
                <div>
                  <dt>火 Burpee</dt>
                  <dd>{w.burpee}</dd>
                </div>
                <div>
                  <dt>木 Quality</dt>
                  <dd>{w.quality}</dd>
                </div>
              </dl>
              {w.note && <p className="week-note">{w.note}</p>}
            </li>
          ))}
        </ul>
      </Fold>

      <Fold title="Bodymake 種目">
        {BODYMAKE.map(b => (
          <div key={b.key} className="ov-block">
            <h4 className="ov-block-title">{b.label}</h4>
            <ExerciseList items={EXERCISES[b.key]} />
          </div>
        ))}
      </Fold>

      <Fold title="食事パターン">
        <MealTabs />
        <h4 className="ov-block-title">調整ルール</h4>
        <ul className="bullet-list">
          {ADJUST_RULES.map(r => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        {MEAL_GUIDE.map(s => (
          <SectionBlock key={s.title} section={s} />
        ))}
      </Fold>

      <Fold title="用語集">
        <dl className="term-list">
          {GLOSSARY.map(t => (
            <div key={t.term}>
              <dt>{t.term}</dt>
              <dd>{t.ja}</dd>
            </div>
          ))}
        </dl>
      </Fold>

      <Fold title="目的とルール">
        <h4 className="ov-block-title">目的</h4>
        <ul className="bullet-list">
          {PLAN_PURPOSE.map(p => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <h4 className="ov-block-title">最優先ルール</h4>
        <ul className="bullet-list">
          {TOP_RULES.map(r => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <h4 className="ov-block-title">毎週のチェック</h4>
        <ul className="bullet-list">
          {WEEKLY_CHECKS.map(c => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </Fold>

      <Fold title="12週後のレビュー">
        <p className="card-note">{REVIEW_HEAD}</p>
        <ul className="check-list">
          {REVIEW_CHECKS.map(c => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </Fold>
    </div>
  )
}

function MealTabs() {
  const [active, setActive] = useState(MEAL_KEYS[0])
  return (
    <>
      <div className="chip-row meal-tabs">
        {MEAL_KEYS.map(k => (
          <button
            key={k}
            className={`chip ${k === active ? 'chip-on meal-on' : ''}`}
            onClick={() => setActive(k)}
          >
            {k}
          </button>
        ))}
      </div>
      <MealTimeline pattern={active} />
    </>
  )
}

function Fold({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="fold">
      <button className="fold-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span>{title}</span>
        <i className={`plan-caret ${open ? 'open' : ''}`}>
          <ChevronIcon size={18} />
        </i>
      </button>
      {open && <div className="fold-body">{children}</div>}
    </section>
  )
}
