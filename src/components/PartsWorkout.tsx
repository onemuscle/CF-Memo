import { useState } from 'react'
import {
  generateForToday,
  shareCode,
  type Answers,
  type Muscle,
  type Workout,
} from '../workout/engine'
import { MUSCLE_LABEL } from '../workout/engine/labels'
import { loadHistory } from '../workout/storage'
import { putMemo } from '../db'
import { newId, type Memo } from '../types'
import { GYM_LABEL } from '../plan/plan'
import type { GymLocation } from '../plan/planData'
import { SubFold, useGymLocation } from './TodayPage'

interface Props {
  onSaved: (memoId: string) => void
}

const MUSCLES: Muscle[] = ['chest', 'back', 'shoulders', 'arms', 'core', 'glutes', 'legs']
const MINUTES = [30, 45, 60] as const

/**
 * 部位・場所・時間 → きょうトレのエンジンでメニューを作る。
 * 目的・レベル等は本人のプロフィールに合わせて固定 (細かく変えたい時はきょうトレ本体へ)。
 */
function answersFor(muscles: Muscle[], location: GymLocation, minutes: number): Answers {
  return {
    env: location === 'home' ? 'home' : 'gym',
    goal: 'muscle',
    focus: muscles,
    minutes,
    level: 'advanced',
    condition: 'normal',
    injuries: [],
    scale: 'men',
    // 家ジム: ダンベル + アジャスタブルベンチ (チェストマシン・有酸素マシンはエンジン外)
    gear: location === 'home' ? ['dumbbell', 'bench'] : [],
    quiet: false,
  }
}

function memoBody(w: Workout, location: GymLocation): string {
  const lines = [`${GYM_LABEL[location]} / 約${w.totalMinutes}分 / ${w.subtitle}`, '']
  for (const b of w.blocks) {
    lines.push(`■ ${b.title} (${b.minutes}分)`)
    for (const it of b.items) {
      const tag = it.tag ? `${it.tag} ` : ''
      const detail = it.detail ? ` — ${it.detail}` : ''
      lines.push(`・${tag}${it.name} ${it.prescription}${detail}`)
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}

export default function PartsWorkout({ onSaved }: Props) {
  const [muscles, setMuscles] = useState<Muscle[]>([])
  const [location, setLocation] = useGymLocation()
  const [minutes, setMinutes] = useState<number>(60)
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [saving, setSaving] = useState(false)

  function toggleMuscle(m: Muscle) {
    setMuscles(prev => (prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]))
    setWorkout(null)
  }

  function generate() {
    const seed = (Date.now() % 2147483647) >>> 0
    setWorkout(generateForToday(answersFor(muscles, location, minutes), seed, loadHistory()))
  }

  async function handleSave() {
    if (!workout) return
    setSaving(true)
    try {
      const now = Date.now()
      const memo: Memo = {
        id: newId(),
        category: 'wod',
        title: `部位トレ: ${workout.focusLabel} (${location === 'home' ? '家ジム' : 'Jexer'})`,
        body: memoBody(workout, location),
        tags: ['部位トレ'],
        imageIds: [],
        createdAt: now,
        updatedAt: now,
      }
      await putMemo(memo)
      onSaved(memo.id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <div className="scan-intro">
        <h2 className="scan-title">部位トレ</h2>
        <p className="scan-sub">
          鍛えたい部位と場所を選ぶと、ウォームアップ込み・時間内に収まるメニューを組みます。
        </p>
      </div>

      <label className="field-label">鍛えたい部位 (複数OK)</label>
      <div className="chip-row wrap">
        {MUSCLES.map(m => (
          <button
            key={m}
            className={`chip ${muscles.includes(m) ? 'chip-on' : ''}`}
            onClick={() => toggleMuscle(m)}
          >
            {MUSCLE_LABEL[m]}
          </button>
        ))}
      </div>

      <label className="field-label">場所</label>
      <div className="gym-toggle" role="group" aria-label="トレーニングする場所">
        {(['jexer', 'home'] as const).map(l => (
          <button
            key={l}
            className={location === l ? 'on' : ''}
            onClick={() => {
              setLocation(l)
              setWorkout(null)
            }}
          >
            {GYM_LABEL[l]}
          </button>
        ))}
      </div>

      <label className="field-label">時間</label>
      <div className="chip-row">
        {MINUTES.map(m => (
          <button
            key={m}
            className={`chip ${minutes === m ? 'chip-on' : ''}`}
            onClick={() => {
              setMinutes(m)
              setWorkout(null)
            }}
          >
            {m}分
          </button>
        ))}
      </div>

      <button className="btn-primary wide" onClick={generate} disabled={muscles.length === 0}>
        {muscles.length === 0
          ? '部位を選んでください'
          : workout
            ? '組み直す (別のメニュー)'
            : 'メニューを作る'}
      </button>

      {workout && (
        <>
          <div className="pw-head">
            <h3 className="pw-title">{workout.title}</h3>
            <span className="pw-total">約{workout.totalMinutes}分</span>
          </div>

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
            </section>
          ))}

          {workout.cautions.length > 0 && (
            <p className="card-note">{workout.cautions.join(' / ')}</p>
          )}

          <SubFold title="なぜこのメニュー?">
            <ul className="bullet-list">
              {[...workout.why, ...workout.next].map(t => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </SubFold>

          <div className="scan-actions">
            <button className="btn-primary wide" onClick={handleSave} disabled={saving}>
              {saving ? '保存中…' : 'このメニューをメモに保存'}
            </button>
            <a
              className="btn-ghost wide pw-link"
              href={`./workout/?w=${shareCode(workout)}`}
              target="_blank"
              rel="noreferrer"
            >
              きょうトレで開く (タイマー・セット記録)
            </a>
          </div>
        </>
      )}
    </div>
  )
}
