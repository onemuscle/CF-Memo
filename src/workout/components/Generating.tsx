import { useEffect, useState } from 'react'
import type { Answers } from '../engine'
import { ENV_LABEL, GOAL_LABEL, musclesText } from '../engine/labels'

interface Props {
  answers: Answers
  onDone: () => void
}

/** メニュー生成中の演出 (実際の計算は一瞬だが、何を考慮したかを見せる) */
export default function Generating({ answers: a, onDone }: Props) {
  const lines = [
    `${ENV_LABEL[a.env]}で使える種目を確認`,
    `「${GOAL_LABEL[a.goal]}」に合う回数・休憩を設定`,
    a.focus.length ? `${musclesText(a.focus)}を中心に種目を選択` : '最近の記録から今日の部位を決定',
    a.injuries.length ? '痛みのある部位に負担の大きい種目を除外' : '体調に合わせて量と強度を調整',
    `${a.minutes}分に収まるよう時間を配分`,
  ]
  const [step, setStep] = useState(0)

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const per = reduce ? 60 : 260
    const id = window.setInterval(() => setStep(s => s + 1), per)
    const done = window.setTimeout(onDone, per * (lines.length + 1))
    return () => {
      window.clearInterval(id)
      window.clearTimeout(done)
    }
    // 1回だけ走らせる
  }, [])

  return (
    <div className="generating" role="status" aria-live="polite">
      <div className="gen-ring" aria-hidden />
      <h1>あなた専用のメニューを作成中…</h1>
      <ul>
        {lines.map((l, i) => (
          <li key={i} className={i < step ? 'done' : i === step ? 'now' : ''}>
            {l}
          </li>
        ))}
      </ul>
    </div>
  )
}
