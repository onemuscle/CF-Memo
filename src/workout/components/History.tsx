import { useState } from 'react'
import type { HistoryEntry } from '../engine'
import { ENV_LABEL, MUSCLES, MUSCLE_LABEL, RATING_LABEL } from '../engine/labels'
import { muscleBalance, recentDays, thisWeekCount, weekStreak } from '../stats'
import { BackIcon, FlameIcon } from './Icons'

interface Props {
  history: HistoryEntry[]
  goal: number
  onGoal: (n: number) => void
  onRemove: (id: string) => void
  onBack: () => void
  onStart: () => void
}

const DOW = ['日', '月', '火', '水', '木', '金', '土']

export default function History({ history, goal, onGoal, onRemove, onBack, onStart }: Props) {
  const [confirm, setConfirm] = useState<string>()
  const week = thisWeekCount(history)
  const streak = weekStreak(history, goal)
  const balance = muscleBalance(history, 7)
  const maxBalance = Math.max(1, ...Object.values(balance))
  const days = recentDays(history, 28)
  const rested = MUSCLES.filter(m => balance[m] === 0)

  return (
    <div className="history">
      <header className="result-top">
        <button className="icon-btn" onClick={onBack} aria-label="戻る">
          <BackIcon size={22} />
        </button>
        <span className="brand-sm">記録</span>
        <span style={{ width: 40 }} />
      </header>

      <section className="stats-grid">
        <div className="stat">
          <strong>{history.length}</strong>
          <span>累計</span>
        </div>
        <div className="stat">
          <strong>
            {week}
            <small>/{goal}</small>
          </strong>
          <span>今週</span>
        </div>
        <div className="stat">
          <strong className="streak">
            <FlameIcon size={20} />
            {streak}
          </strong>
          <span>週連続達成</span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>週の目標</h2>
          <div className="goal-picker" role="radiogroup" aria-label="週の目標回数">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <button key={n} className={n === goal ? 'on' : ''} onClick={() => onGoal(n)} role="radio" aria-checked={n === goal}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="calendar" aria-label="直近4週間">
          {days.slice(0, 7).map(d => (
            <span key={`h-${d.dow}`} className="cal-dow">
              {DOW[d.dow]}
            </span>
          ))}
          {days.map(d => (
            <span key={d.date} className={`cal-day ${d.done ? 'on' : ''}`} title={d.date}>
              {Number(d.date.slice(8))}
            </span>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>直近7日の部位バランス</h2>
        </div>
        <div className="balance">
          {MUSCLES.map(m => (
            <div key={m} className="balance-row">
              <span>{MUSCLE_LABEL[m]}</span>
              <div className="balance-bar">
                <div style={{ width: `${(balance[m] / maxBalance) * 100}%` }} />
              </div>
              <b>{balance[m]}</b>
            </div>
          ))}
        </div>
        {history.length > 0 && rested.length > 0 && (
          <p className="panel-note">
            この1週間 {rested.map(m => MUSCLE_LABEL[m]).join('・')} を鍛えていません。次回「おまかせ」を選ぶと優先して組みます。
          </p>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>これまでの記録</h2>
        </div>
        {history.length === 0 ? (
          <div className="empty">
            <p>まだ記録がありません。メニューを終えたら「完了する」で記録しましょう。</p>
            <button className="btn btn-primary" onClick={onStart}>
              今日のメニューを作る
            </button>
          </div>
        ) : (
          <ul className="log">
            {history.map(h => (
              <li key={h.id}>
                <div className="log-date">
                  {Number(h.date.slice(5, 7))}/{Number(h.date.slice(8))}
                </div>
                <div className="log-body">
                  <div className="log-title">{h.title}</div>
                  <div className="log-meta">
                    {ENV_LABEL[h.env]} · {h.minutes}分{h.rating ? ` · ${RATING_LABEL[h.rating]}` : ''}
                    {h.score ? ` · スコア ${h.score}` : ''}
                  </div>
                </div>
                {confirm === h.id ? (
                  <button className="btn btn-danger btn-sm" onClick={() => onRemove(h.id)}>
                    削除
                  </button>
                ) : (
                  <button className="btn btn-link btn-sm" onClick={() => setConfirm(h.id)} aria-label="この記録を削除">
                    …
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="disclaimer">記録はこの端末のブラウザ内にだけ保存されます。サイトデータを消去すると記録も消えます。</p>
    </div>
  )
}
