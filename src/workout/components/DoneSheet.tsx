import { useState } from 'react'
import type { Rating, Workout } from '../engine'
import { RATING_LABEL } from '../engine/labels'
import { renderShareImage, shareOrDownload } from '../shareImage'
import { track } from '../track'
import { shareLinks } from './ShareMenu'
import { FlameIcon, ImageIcon } from './Icons'

export interface DoneStats {
  total: number
  week: number
  goal: number
  streak: number
}

interface Props {
  workout: Workout
  initialScore?: string
  progress: { finished: number; total: number }
  siteUrl: string
  onSave: (rating: Rating, score?: string) => DoneStats
  onClose: () => void
  onHome: () => void
}

const RATINGS: { value: Rating; emoji: string }[] = [
  { value: 'easy', emoji: '😌' },
  { value: 'good', emoji: '💪' },
  { value: 'hard', emoji: '🥵' },
]

export default function DoneSheet({ workout, initialScore, progress, siteUrl, onSave, onClose, onHome }: Props) {
  const [rating, setRating] = useState<Rating>()
  const [score, setScore] = useState(initialScore ?? '')
  const [stats, setStats] = useState<DoneStats>()
  const [busy, setBusy] = useState(false)
  const isBox = workout.answers.env === 'box'

  async function shareImage() {
    if (!stats) return
    setBusy(true)
    const blob = await renderShareImage(workout, { streakWeeks: stats.streak, total: stats.total, score: score || undefined, url: siteUrl })
    setBusy(false)
    if (!blob) return
    const result = await shareOrDownload(blob, `${workout.title} 完了!\n#きょうトレ ${siteUrl}`)
    track('share', { method: result, what: 'image' })
  }

  if (!stats) {
    return (
      <div className="sheet-backdrop" onClick={onClose}>
        <div className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="ワークアウトの記録">
          <h2 className="done-title">おつかれさまでした!</h2>
          <p className="sheet-sub">
            {progress.total > 0 && `${progress.finished}/${progress.total} セット完了。`}
            今日のきつさを教えてください。次回のメニューの量に反映します。
          </p>
          <div className="rating">
            {RATINGS.map(r => (
              <button key={r.value} className={`rating-btn ${rating === r.value ? 'on' : ''}`} onClick={() => setRating(r.value)} aria-pressed={rating === r.value}>
                <span className="rating-emoji">{r.emoji}</span>
                {RATING_LABEL[r.value]}
              </button>
            ))}
          </div>
          {isBox && (
            <label className="score-input">
              WODのスコア (任意)
              <input value={score} onChange={e => setScore(e.target.value)} placeholder="例: 7ラウンド+5回 / 12:34" />
            </label>
          )}
          <button
            className="btn btn-primary btn-block"
            disabled={!rating}
            onClick={() => {
              const s = onSave(rating!, score.trim() || undefined)
              track('complete_workout', { env: workout.answers.env, goal: workout.answers.goal, rating: rating!, minutes: workout.answers.minutes })
              setStats(s)
            }}
          >
            記録する
          </button>
          <button className="btn btn-link btn-block" onClick={onClose}>
            まだ続ける
          </button>
        </div>
      </div>
    )
  }

  const text = `「${workout.title}」${workout.totalMinutes}分のトレーニング完了! ${stats.streak >= 2 ? `${stats.streak}週連続で目標達成中🔥` : ''}`
  const links = shareLinks(text, siteUrl)
  const left = Math.max(0, stats.goal - stats.week)

  return (
    <div className="sheet-backdrop">
      <div className="sheet celebrate" role="dialog" aria-label="記録しました">
        <div className="confetti" aria-hidden>
          {Array.from({ length: 18 }, (_, i) => (
            <i key={i} style={{ left: `${(i * 53) % 100}%`, animationDelay: `${(i % 6) * 0.12}s` }} />
          ))}
        </div>
        <div className="celebrate-kicker">WORKOUT COMPLETE</div>
        <h2 className="done-title">{stats.total}回目のトレーニング達成!</h2>

        <div className="done-stats">
          <div>
            <strong>
              {stats.week}
              <small>/{stats.goal}</small>
            </strong>
            <span>今週の回数</span>
          </div>
          {stats.streak > 0 ? (
            <div>
              <strong className="streak">
                <FlameIcon size={22} />
                {stats.streak}
              </strong>
              <span>週連続で目標達成</span>
            </div>
          ) : (
            <div>
              <strong>{stats.total}</strong>
              <span>累計の回数</span>
            </div>
          )}
          <div>
            <strong>{workout.totalMinutes}</strong>
            <span>分</span>
          </div>
        </div>
        <p className="sheet-sub">
          {left > 0 ? `今週の目標まであと${left}回。次回は「おまかせ」で、今日休ませた部位を中心に組みます。` : '今週の目標を達成しました! この調子で来週も続けましょう。'}
        </p>

        <button className="btn btn-primary btn-block" onClick={shareImage} disabled={busy}>
          <ImageIcon size={18} /> {busy ? '画像を作成中…' : '記録を画像でシェア'}
        </button>
        <div className="share-row">
          <a className="share-btn x" href={links.x} target="_blank" rel="noopener noreferrer" onClick={() => track('share', { method: 'x', what: 'done' })}>
            Xに投稿
          </a>
          <a className="share-btn line" href={links.line} target="_blank" rel="noopener noreferrer" onClick={() => track('share', { method: 'line', what: 'done' })}>
            LINEで送る
          </a>
        </div>
        <button className="btn btn-ghost btn-block" onClick={onHome}>
          ホームへ
        </button>
      </div>
    </div>
  )
}
