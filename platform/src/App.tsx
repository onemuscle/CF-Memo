import { useState } from 'react'
import { entity } from '../../shared/schema.ts'
import type { Row } from './api.ts'
import EntityForm from './components/EntityForm.tsx'
import Icon from './components/Icon.tsx'
import { Sheet } from './components/ui.tsx'
import { DataProvider, useData } from './data.tsx'
import AnalysisPage from './pages/AnalysisPage.tsx'
import Dashboard from './pages/Dashboard.tsx'
import GoalsPage from './pages/GoalsPage.tsx'
import LogPage from './pages/LogPage.tsx'
import MorePage from './pages/MorePage.tsx'

export const APP_NAME = 'VITALOG'

type Tab = 'home' | 'log' | 'analysis' | 'goals' | 'more'

const TABS: { key: Tab | 'add'; label: string; icon: string }[] = [
  { key: 'home', label: 'ホーム', icon: 'home' },
  { key: 'log', label: '履歴', icon: 'history' },
  { key: 'add', label: '記録', icon: 'plus' },
  { key: 'analysis', label: '分析', icon: 'chart' },
  { key: 'goals', label: '目標', icon: 'target' },
]

/** 「＋」から選ぶ記録の種類 (上ほどよく使う) */
export const ADD_MAIN: { name: string; label: string; hint: string }[] = [
  { name: 'workouts', label: 'WOD', hint: 'トレーニング全般。写真で自動入力' },
  { name: 'strength_sets', label: '重量×回数', hint: 'スクワット 120kg × 5 など' },
  { name: 'cardio_sessions', label: '有酸素', hint: 'ラン・バイク・Zone2' },
  { name: 'body_metrics', label: '体重・体組成', hint: '体重・体脂肪率・腹囲' },
  { name: 'nutrition_entries', label: '食事', hint: 'カロリー・PFC' },
  { name: 'sleep_logs', label: '睡眠', hint: '時間・質' },
  { name: 'wellness', label: 'コンディション', hint: '疲労・筋肉痛・体調' },
  { name: 'skill_logs', label: 'スキル', hint: 'Ring Muscle-up など' },
]
export const ADD_MORE = ['races', 'injuries', 'supplements', 'nutrition_targets', 'goals', 'journal']

interface SheetState {
  name: string
  row?: Row
  defaults?: Record<string, unknown>
}

function Shell() {
  const [tab, setTab] = useState<Tab>('home')
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [picker, setPicker] = useState(false)
  const { bundle, loading, error, refresh, pending } = useData()
  const open = (name: string, row?: Row, defaults?: Record<string, unknown>) => {
    setPicker(false)
    setSheet({ name, row, defaults })
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setTab('home')} aria-label={`${APP_NAME} ホーム`}>
          <img src="/icon.svg" alt="" width={26} height={26} />
          <span>{APP_NAME}</span>
        </button>
        <button className={`icon-btn plain ${tab === 'more' ? 'on' : ''}`} onClick={() => setTab('more')} aria-label="設定">
          <Icon name="settings" />
        </button>
      </header>
      {pending > 0 && <div className="banner warn">送信待ち {pending} 件 — 電波が戻ると自動で送ります</div>}
      {error && (
        <div className="banner err">
          <span>{error}</span>
          <button className="link-btn" onClick={() => (error.includes('再読み込み') ? location.reload() : refresh())}>
            再試行
          </button>
        </div>
      )}
      <main>
        {!bundle && loading && <div className="loading">読み込み中…</div>}
        {bundle && tab === 'home' && <Dashboard onOpen={open} onAdd={() => setPicker(true)} onGo={t => setTab(t)} />}
        {bundle && tab === 'log' && <LogPage onOpen={open} />}
        {bundle && tab === 'analysis' && <AnalysisPage onOpen={open} />}
        {bundle && tab === 'goals' && <GoalsPage onOpen={open} />}
        {tab === 'more' && <MorePage />}
      </main>
      <nav className="tabbar">
        {TABS.map(t =>
          t.key === 'add' ? (
            <button key="add" className="tab-add" onClick={() => setPicker(true)} aria-label="記録する">
              <span>
                <Icon name="plus" size={28} />
              </span>
            </button>
          ) : (
            <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key as Tab)} aria-current={tab === t.key}>
              <Icon name={t.icon} />
              <span>{t.label}</span>
            </button>
          ),
        )}
      </nav>
      {picker && (
        <Sheet title="何を記録しますか?" onClose={() => setPicker(false)}>
          <div className="picker">
            {ADD_MAIN.map(a => (
              <button key={a.name} className="picker-item" onClick={() => open(a.name)}>
                <span className={`picker-icon g-${entity(a.name)!.group}`}>
                  <Icon name={a.name} />
                </span>
                <span className="picker-text">
                  <b>{a.label}</b>
                  <small>{a.hint}</small>
                </span>
              </button>
            ))}
          </div>
          <h3 className="sub-head">その他</h3>
          <div className="chips">
            {ADD_MORE.map(n => (
              <button key={n} className="chip" onClick={() => open(n, undefined, n === 'goals' ? { status: 'active' } : undefined)}>
                {entity(n)!.label}
              </button>
            ))}
          </div>
        </Sheet>
      )}
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
