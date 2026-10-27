// はじめての記録・自己ベスト更新のお祝い。紙吹雪の中でキャラクターがダンベルを持ち上げる。

import { useEffect, type CSSProperties } from 'react'
import Mascot from './Mascot'

export interface Celebration {
  /** 大きな見出し (例: 自己ベスト更新！) */
  title: string
  /** 種目と記録 */
  detail: string
  /** 伸び幅など (例: +2.5kg) */
  badge?: string
  /** キャラクターのひとこと */
  line: string
}

const COLORS = ['var(--c-lime)', 'var(--c-pink)', 'var(--c-cyan)', 'var(--c-yellow)', 'var(--c-violet)', 'var(--c-orange)']

/** 紙吹雪の1枚ずつの位置・遅れ・回転 (毎回同じ並びでよいので乱数は使わない) */
const PIECES = Array.from({ length: 42 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 53) % 90) / 100,
  duration: 2.2 + ((i * 29) % 12) / 10,
  drift: ((i * 17) % 60) - 30,
  spin: ((i * 71) % 2 ? 1 : -1) * (360 + ((i * 41) % 360)),
  color: COLORS[i % COLORS.length],
  round: i % 3 === 0,
}))

export default function Celebrate({ c, onClose }: { c: Celebration; onClose: () => void }) {
  useEffect(() => {
    // 対応端末では軽く振動させる
    try {
      navigator.vibrate?.([30, 60, 30])
    } catch {
      // 振動できなくてもよい
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="celebrate" role="dialog" aria-modal="true" aria-label={c.title} onClick={onClose}>
      <div className="confetti" aria-hidden>
        {PIECES.map((p, i) => (
          <i
            key={i}
            className={p.round ? 'round' : ''}
            style={
              {
                left: `${p.left}%`,
                background: p.color,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                '--drift': `${p.drift}vw`,
                '--spin': `${p.spin}deg`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="celebrate-card" onClick={e => e.stopPropagation()}>
        <div className="celebrate-glow" aria-hidden />
        <Mascot mood="cheer" size={132} className="celebrate-mascot" />
        <p className="celebrate-title">{c.title}</p>
        <p className="celebrate-detail">{c.detail}</p>
        {c.badge && <span className="celebrate-badge">{c.badge}</span>}
        <p className="celebrate-line">{c.line}</p>
        <button className="btn-primary wide" onClick={onClose} autoFocus>
          やったね！
        </button>
      </div>
    </div>
  )
}
