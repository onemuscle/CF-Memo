// Fitto のキャラクター。おもち形の体にヘアバンド。色はテーマの CSS 変数 (--mascot-*) に合わせる。

import type { CSSProperties, ReactNode } from 'react'

export type Mood = 'smile' | 'happy' | 'wink' | 'cheer' | 'think' | 'sleep'

interface Props {
  mood?: Mood
  size?: number
  /** ふわふわ上下に揺れる */
  bounce?: boolean
  className?: string
  style?: CSSProperties
}

const INK = 'var(--mascot-ink)'

function Eyes({ mood }: { mood: Mood }) {
  if (mood === 'sleep') {
    return (
      <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M41 63q6 5 12 0" />
        <path d="M67 63q6 5 12 0" />
      </g>
    )
  }
  if (mood === 'happy' || mood === 'cheer') {
    return (
      <g stroke={INK} strokeWidth="3.4" strokeLinecap="round" fill="none">
        <path d="M41 64q6-8 12 0" />
        <path d="M67 64q6-8 12 0" />
      </g>
    )
  }
  return (
    <g>
      <ellipse cx="47" cy="62" rx="4.6" ry="6" fill={INK} />
      <circle cx="48.6" cy="59.6" r="1.7" fill="#fff" />
      {mood === 'wink' ? (
        <path d="M67 63q6-6 12 0" stroke={INK} strokeWidth="3.4" strokeLinecap="round" fill="none" />
      ) : (
        <>
          <ellipse cx="73" cy="62" rx="4.6" ry="6" fill={INK} />
          <circle cx="74.6" cy="59.6" r="1.7" fill="#fff" />
        </>
      )}
    </g>
  )
}

function Mouth({ mood }: { mood: Mood }) {
  if (mood === 'happy' || mood === 'cheer') {
    return <path d="M53 72q7 9 14 0z" fill="var(--mascot-mouth)" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
  }
  if (mood === 'think') return <path d="M55 75h10" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
  if (mood === 'sleep') return <ellipse cx="60" cy="75" rx="3" ry="2.4" fill={INK} />
  return <path d="M54 72q6 6 12 0" stroke={INK} strokeWidth="2.8" strokeLinecap="round" fill="none" />
}

export default function Mascot({ mood = 'smile', size = 96, bounce = false, className = '', style }: Props) {
  const armsUp = mood === 'cheer'
  return (
    <svg
      className={`mascot ${bounce ? 'bounce' : ''} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Fitto のキャラクター"
      style={style}
    >
      {/* 影 */}
      <ellipse cx="60" cy="110" rx="30" ry="4.5" fill="var(--mascot-ink)" opacity="0.12" />

      {/* 腕 (応援のときはダンベルを持ち上げる) */}
      {armsUp ? (
        <g>
          <path d="M28 70q-12-10-10-26" stroke="var(--mascot-body-dark)" strokeWidth="8" strokeLinecap="round" fill="none" />
          <path d="M92 70q12-10 10-26" stroke="var(--mascot-body-dark)" strokeWidth="8" strokeLinecap="round" fill="none" />
          <g fill="var(--mascot-band)">
            <rect x="8" y="36" width="20" height="4" rx="2" />
            <rect x="6" y="31" width="5" height="14" rx="2" />
            <rect x="25" y="31" width="5" height="14" rx="2" />
            <rect x="92" y="36" width="20" height="4" rx="2" />
            <rect x="90" y="31" width="5" height="14" rx="2" />
            <rect x="109" y="31" width="5" height="14" rx="2" />
          </g>
        </g>
      ) : (
        <g stroke="var(--mascot-body-dark)" strokeWidth="8" strokeLinecap="round" fill="none">
          <path d="M27 76q-9 4-10 12" />
          <path d="M93 76q9 4 10 12" />
        </g>
      )}

      {/* 足 */}
      <ellipse cx="46" cy="104" rx="9" ry="5.5" fill="var(--mascot-body-dark)" />
      <ellipse cx="74" cy="104" rx="9" ry="5.5" fill="var(--mascot-body-dark)" />

      {/* 体 (おもち形) */}
      <path
        d="M60 24c22 0 37 17 37 42 0 24-15 38-37 38S23 90 23 66c0-25 15-42 37-42z"
        fill="var(--mascot-body)"
        stroke="var(--mascot-body-dark)"
        strokeWidth="2"
      />
      {/* つや */}
      <ellipse cx="44" cy="40" rx="8" ry="4.5" fill="#fff" opacity="0.45" transform="rotate(-24 44 40)" />

      {/* ヘアバンド */}
      <path d="M26.5 50c20-9 47-9 67 0l-1.5 8c-20-8-44-8-64 0z" fill="var(--mascot-band)" />
      <path d="M93 52l9-5-2 10z" fill="var(--mascot-band)" />

      {/* ほっぺ */}
      <ellipse cx="38" cy="72" rx="6" ry="3.8" fill="var(--mascot-cheek)" opacity="0.75" />
      <ellipse cx="82" cy="72" rx="6" ry="3.8" fill="var(--mascot-cheek)" opacity="0.75" />

      <Eyes mood={mood} />
      <Mouth mood={mood} />

      {mood === 'sleep' && (
        <g fill="var(--text-dim)" fontFamily="var(--font-display)" fontWeight="700">
          <text x="92" y="30" fontSize="14">z</text>
          <text x="102" y="18" fontSize="10">z</text>
        </g>
      )}
      {mood === 'think' && (
        <g fill="var(--text-dim)">
          <circle cx="98" cy="30" r="3" />
          <circle cx="106" cy="20" r="4.5" />
        </g>
      )}
    </svg>
  )
}

/** キャラクター + 吹き出し */
export function MascotSays({
  mood = 'smile',
  size = 64,
  children,
  className = '',
}: {
  mood?: Mood
  size?: number
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`mascot-says ${className}`}>
      <Mascot mood={mood} size={size} bounce />
      <p className="mascot-bubble">{children}</p>
    </div>
  )
}
