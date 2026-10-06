import { useState } from 'react'
import { shareText, type Workout } from '../engine'
import { track } from '../track'
import { CloseIcon, LinkIcon, ShareIcon } from './Icons'

interface Props {
  workout: Workout
  url: string
  onClose: () => void
}

export function shareLinks(text: string, url: string) {
  return {
    line: `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent('きょうトレ')}`,
  }
}

export async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** メニュー (URL) を友だち・トレーニング仲間に送る */
export default function ShareMenu({ workout, url, onClose }: Props) {
  const [copied, setCopied] = useState(false)
  const text = `${shareText(workout)}\n一緒にやろう💪`
  const links = shareLinks(text, url)

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="メニューを共有">
        <div className="sheet-head">
          <h2>このメニューを送る</h2>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">
            <CloseIcon size={20} />
          </button>
        </div>
        <p className="sheet-sub">リンクを開くと、同じメニューがそのまま表示されます。トレーニング仲間と同じWODに挑戦しよう。</p>
        <div className="share-grid">
          <a className="share-btn line" href={links.line} target="_blank" rel="noopener noreferrer" onClick={() => track('share', { method: 'line', what: 'menu' })}>
            LINE
          </a>
          <a className="share-btn x" href={links.x} target="_blank" rel="noopener noreferrer" onClick={() => track('share', { method: 'x', what: 'menu' })}>
            X
          </a>
          <button
            className="share-btn"
            onClick={async () => {
              setCopied(await copy(url))
              track('share', { method: 'copy', what: 'menu' })
            }}
          >
            <LinkIcon size={18} /> {copied ? 'コピーしました' : 'リンクをコピー'}
          </button>
          {'share' in navigator && (
            <button
              className="share-btn"
              onClick={() => {
                track('share', { method: 'native', what: 'menu' })
                navigator.share({ title: workout.title, text, url }).catch(() => {})
              }}
            >
              <ShareIcon size={18} /> その他
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
