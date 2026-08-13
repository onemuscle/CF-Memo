import { useCallback, useEffect, useState } from 'react'
import { listMemos, listPRs } from './db'
import type { Memo, PR } from './types'
import MemoList from './components/MemoList'
import MemoDetail from './components/MemoDetail'
import MemoEditor from './components/MemoEditor'
import { PRList, MovementDetail, PRForm } from './components/PRPage'
import WodScan from './components/WodScan'
import { NoteIcon, TrophyIcon, ScanIcon } from './components/Icons'

type Tab = 'memos' | 'prs' | 'scan'

type View =
  | { name: 'home' }
  | { name: 'memo-detail'; id: string }
  | { name: 'memo-edit'; id?: string }
  | { name: 'movement'; movementKey: string }
  | { name: 'pr-edit'; id?: string; movement?: string }

const TABS: { key: Tab; label: string; icon: (p: { size?: number }) => JSX.Element }[] = [
  { key: 'memos', label: 'メモ', icon: NoteIcon },
  { key: 'prs', label: 'PR記録', icon: TrophyIcon },
  { key: 'scan', label: 'スキャン', icon: ScanIcon },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('memos')
  const [view, setView] = useState<View>({ name: 'home' })
  const [memos, setMemos] = useState<Memo[]>([])
  const [prs, setPRs] = useState<PR[]>([])

  const refresh = useCallback(async () => {
    const [m, p] = await Promise.all([listMemos(), listPRs()])
    setMemos(m)
    setPRs(p)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const home = () => setView({ name: 'home' })

  // 削除などで参照先のメモが消えた場合はホームに戻す
  const missingMemo =
    view.name === 'memo-detail' && !memos.some(m => m.id === view.id)
  useEffect(() => {
    if (missingMemo) home()
  }, [missingMemo])

  function renderView() {
    switch (view.name) {
      case 'memo-detail': {
        const memo = memos.find(m => m.id === view.id)
        if (!memo) return null
        return (
          <MemoDetail
            memo={memo}
            onBack={home}
            onEdit={() => setView({ name: 'memo-edit', id: memo.id })}
            onDeleted={async () => {
              await refresh()
              home()
            }}
          />
        )
      }
      case 'memo-edit': {
        const memo = view.id ? memos.find(m => m.id === view.id) : undefined
        return (
          <MemoEditor
            memo={memo}
            onSaved={async saved => {
              await refresh()
              setView({ name: 'memo-detail', id: saved.id })
            }}
            onCancel={() =>
              view.id ? setView({ name: 'memo-detail', id: view.id }) : home()
            }
          />
        )
      }
      case 'movement':
        return (
          <MovementDetail
            prs={prs}
            movementKey={view.movementKey}
            onBack={home}
            onEdit={id => setView({ name: 'pr-edit', id })}
            onAdd={movement => setView({ name: 'pr-edit', movement })}
            onChanged={refresh}
          />
        )
      case 'pr-edit': {
        const pr = view.id ? prs.find(p => p.id === view.id) : undefined
        return (
          <PRForm
            pr={pr}
            prs={prs}
            defaultMovement={view.movement}
            onSaved={async saved => {
              await refresh()
              setView({ name: 'movement', movementKey: saved.movementKey })
            }}
            onDeleted={async deleted => {
              await refresh()
              setView({ name: 'movement', movementKey: deleted.movementKey })
            }}
            onCancel={() =>
              pr
                ? setView({ name: 'movement', movementKey: pr.movementKey })
                : home()
            }
          />
        )
      }
      default:
        return null
    }
  }

  function renderTab() {
    switch (tab) {
      case 'memos':
        return (
          <MemoList
            memos={memos}
            onOpen={id => setView({ name: 'memo-detail', id })}
            onNew={() => setView({ name: 'memo-edit' })}
          />
        )
      case 'prs':
        return (
          <PRList
            prs={prs}
            onOpenMovement={key => setView({ name: 'movement', movementKey: key })}
            onNew={() => setView({ name: 'pr-edit' })}
          />
        )
      case 'scan':
        return (
          <WodScan
            onSaved={async memoId => {
              await refresh()
              setTab('memos')
              setView({ name: 'memo-detail', id: memoId })
            }}
          />
        )
    }
  }

  const overlay = view.name !== 'home'

  return (
    <div className="app">
      {!overlay && (
        <header className="app-header">
          <div className="logo">
            CF<span>MEMO</span>
          </div>
          <div className="logo-sub">TRAIN · EAT · REST</div>
        </header>
      )}
      <main className="app-main">{overlay ? renderView() : renderTab()}</main>
      {!overlay && (
        <nav className="tabbar">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`tab ${tab === key ? 'active' : ''}`}
              onClick={() => setTab(key)}
            >
              <Icon size={22} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}
