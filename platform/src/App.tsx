import { useState } from 'react'
import { entity } from '../../shared/schema.ts'
import type { Row } from './api.ts'
import EntityForm from './components/EntityForm.tsx'
import { Sheet } from './components/ui.tsx'
import { DataProvider, useData } from './data.tsx'
import AnalysisPage from './pages/AnalysisPage.tsx'
import Dashboard from './pages/Dashboard.tsx'
import GoalsPage from './pages/GoalsPage.tsx'
import LogPage from './pages/LogPage.tsx'
import MorePage from './pages/MorePage.tsx'

type Tab = 'home' | 'log' | 'analysis' | 'goals' | 'more'

const TABS: { key: Tab; label: string; icon: JSX.Element }[] = [
  { key: 'home', label: 'ホーム', icon: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /> },
  { key: 'log', label: '記録', icon: <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /> },
  { key: 'analysis', label: '分析', icon: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> },
  { key: 'goals', label: '目標', icon: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.5" /></> },
  { key: 'more', label: '設定', icon: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></> },
]

interface SheetState {
  name: string
  row?: Row
  defaults?: Record<string, unknown>
}

function Shell() {
  const [tab, setTab] = useState<Tab>('home')
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const { bundle, loading, error, refresh, pending } = useData()
  const open = (name: string, row?: Row, defaults?: Record<string, unknown>) => setSheet({ name, row, defaults })

  return (
    <div className="app">
      {pending > 0 && <div className="banner warn">送信待ち {pending} 件 — 通信が戻ると自動で送ります</div>}
      {error && (
        <div className="banner err">
          {error}
          <button className="link-btn" onClick={() => (error.includes('再読み込み') ? location.reload() : refresh())}>
            再試行
          </button>
        </div>
      )}
      <main>
        {!bundle && loading && <div className="loading">読み込み中…</div>}
        {bundle && tab === 'home' && <Dashboard onQuick={k => open(k)} onGo={t => setTab(t)} />}
        {bundle && tab === 'log' && <LogPage onOpen={open} />}
        {bundle && tab === 'analysis' && <AnalysisPage onOpen={open} />}
        {bundle && tab === 'goals' && <GoalsPage onOpen={open} />}
        {tab === 'more' && <MorePage />}
      </main>
      <nav className="tabbar">
        {TABS.map(t => (
          <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)} aria-current={tab === t.key}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {t.icon}
            </svg>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      {sheet && (
        <Sheet title={`${entity(sheet.name)?.label ?? ''}${sheet.row ? 'を編集' : 'を記録'}`} onClose={() => setSheet(null)}>
          <EntityForm key={sheet.row?.id ?? sheet.name} name={sheet.name} initial={sheet.row} defaults={sheet.defaults} onDone={() => setSheet(null)} />
        </Sheet>
      )}
    </div>
  )
}

export default function App() {
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  )
}
