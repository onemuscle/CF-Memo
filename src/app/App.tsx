import { useCallback, useEffect, useMemo, useState } from 'react'
import { deleteSetting, listMemos, listPRs } from '../db'
import type { Memo, PR } from '../types'
import MemoList from '../components/MemoList'
import MemoDetail from '../components/MemoDetail'
import MemoEditor, { type MemoDraft } from '../components/MemoEditor'
import { PRList, MovementDetail, PRForm } from '../components/PRPage'
import WodScan from '../components/WodScan'
import PartsWorkout, { type PartsPlace } from '../components/PartsWorkout'
import { NoteIcon, TrophyIcon, ScanIcon, TodayIcon, DumbbellIcon, UserIcon } from '../components/Icons'
import { ENV_LABEL } from '../workout/engine/labels'
import type { Env, Gear } from '../workout/engine'
import Onboarding, { Welcome } from './components/Onboarding'
import PlanSummary, { Generating } from './components/PlanSummary'
import PlanToday from './components/PlanToday'
import { PROFILE_SETTING, loadProfile, saveProfile, type Profile } from './profile'
import { buildPlan } from './plan/plan'
import { answersFor } from './plan/workout'
import { applyTheme } from './theme'

type Tab = 'today' | 'parts' | 'memos' | 'prs' | 'scan'

type View =
  | { name: 'home' }
  | { name: 'memo-detail'; id: string }
  | { name: 'memo-edit'; id?: string; draft?: MemoDraft }
  | { name: 'movement'; movementKey: string }
  | { name: 'pr-edit'; id?: string; movement?: string }
  | { name: 'plan' }

/** プロフィールが無い / 作成中 / 作成直後 / 通常 */
type Stage = 'loading' | 'welcome' | 'onboarding' | 'editing' | 'generating' | 'ready' | 'main'

const TABS: { key: Tab; label: string; icon: (p: { size?: number }) => JSX.Element }[] = [
  { key: 'today', label: '今日', icon: TodayIcon },
  { key: 'parts', label: '部位トレ', icon: DumbbellIcon },
  { key: 'memos', label: 'メモ', icon: NoteIcon },
  { key: 'prs', label: 'PR記録', icon: TrophyIcon },
  { key: 'scan', label: 'スキャン', icon: ScanIcon },
]

const PLACE_ICON: Record<Env, string> = { gym: '🏋️', box: '🔥', home: '🏠', outdoor: '🌳' }
const PARTS_ENVS: Env[] = ['gym', 'box', 'home', 'outdoor']
const HOME_GEAR: Gear[] = ['dumbbell', 'band', 'kettlebell', 'bench', 'bar']
const OUTDOOR_GEAR: Gear[] = ['bar', 'bench', 'stairs', 'band']

export default function App() {
  const [stage, setStage] = useState<Stage>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tab, setTab] = useState<Tab>('today')
  const [view, setView] = useState<View>({ name: 'home' })
  const [memos, setMemos] = useState<Memo[]>([])
  const [prs, setPRs] = useState<PR[]>([])

  const plan = useMemo(() => (profile ? buildPlan(profile) : null), [profile])

  const refresh = useCallback(async () => {
    const [m, p] = await Promise.all([listMemos(), listPRs()])
    setMemos(m)
    setPRs(p)
  }, [])

  useEffect(() => {
    loadProfile().then(p => {
      if (p?.theme) applyTheme(p.theme)
      setProfile(p)
      setStage(p ? 'main' : 'welcome')
    })
    refresh()
  }, [refresh])

  const home = () => setView({ name: 'home' })

  const missingMemo = view.name === 'memo-detail' && !memos.some(m => m.id === view.id)
  useEffect(() => {
    if (missingMemo) home()
  }, [missingMemo])

  // 画面が切り替わったら先頭から見せる
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [stage, tab, view.name])

  /** 部位トレの場所は4つすべてから選べる (最初はプロフィールで選んだ場所) */
  const partsPlaces: PartsPlace[] = useMemo(() => {
    if (!profile) return []
    return PARTS_ENVS.map(env => ({
      key: env,
      label: `${PLACE_ICON[env]} ${ENV_LABEL[env]}`,
      gearOptions: env === 'home' ? HOME_GEAR : env === 'outdoor' ? OUTDOOR_GEAR : undefined,
      answers: (muscles, minutes, gear) => ({
        ...answersFor(profile, { type: 'strength', label: '', focus: muscles, fullBody: false, env }, 'normal'),
        minutes,
        gear,
      }),
    }))
  }, [profile])

  async function finishOnboarding(p: Profile) {
    await saveProfile(p)
    setProfile(p)
    setStage('generating')
  }

  async function resetProfile() {
    await deleteSetting(PROFILE_SETTING)
    setProfile(null)
    home()
    setTab('today')
    setStage('welcome')
  }

  // ---------------------------------------------------------------- オンボーディング

  if (stage === 'loading') return <div className="splash" />
  if (stage === 'welcome') return <Welcome onStart={() => setStage('onboarding')} />
  if (stage === 'onboarding' || stage === 'editing') {
    return (
      <Onboarding
        initial={stage === 'editing' ? profile ?? undefined : undefined}
        onDone={finishOnboarding}
        onExit={() => {
          // 質問の途中で色を試したまま戻ったら、保存済みの色に戻す
          if (stage === 'editing' && profile?.theme) applyTheme(profile.theme)
          setStage(stage === 'editing' ? 'main' : 'welcome')
        }}
      />
    )
  }
  if (stage === 'generating' && profile) {
    return <Generating weeks={profile.weeks} onDone={() => setStage('ready')} />
  }
  if (stage === 'ready' && plan) {
    return (
      <div className="app">
        <PlanSummary
          plan={plan}
          mode="ready"
          onStart={() => {
            home()
            setTab('today')
            setStage('main')
          }}
          onEdit={() => setStage('editing')}
        />
      </div>
    )
  }
  if (!plan || !profile) return null

  // ---------------------------------------------------------------- 通常画面

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
            draft={view.draft}
            onSaved={async saved => {
              await refresh()
              setView({ name: 'memo-detail', id: saved.id })
            }}
            onCancel={() => (view.id ? setView({ name: 'memo-detail', id: view.id }) : home())}
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
            onCancel={() => (pr ? setView({ name: 'movement', movementKey: pr.movementKey }) : home())}
          />
        )
      }
      case 'plan':
        return (
          <PlanSummary
            plan={plan!}
            mode="overview"
            onBack={home}
            onTheme={async theme => {
              applyTheme(theme)
              const next = { ...profile!, theme }
              await saveProfile(next)
              setProfile(next)
            }}
            onEdit={() => {
              home()
              setStage('editing')
            }}
            onReset={resetProfile}
          />
        )
      default:
        return null
    }
  }

  function renderTab() {
    switch (tab) {
      case 'today':
        return (
          <PlanToday
            plan={plan!}
            onWriteMemo={draft => setView({ name: 'memo-edit', draft })}
            onOpenPlan={() => setView({ name: 'plan' })}
            onNewPlan={() => setStage('editing')}
          />
        )
      case 'parts':
        return (
          <PartsWorkout
            places={partsPlaces}
            defaultPlace={profile!.places[0]}
            defaultGear={profile!.gear}
            kyotoreUrl="../workout/"
            onSaved={async memoId => {
              await refresh()
              setTab('memos')
              setView({ name: 'memo-detail', id: memoId })
            }}
          />
        )
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
            advise={false}
            ocrBase=".."
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
          <div className="logo brand">
            Fit<span>to</span>
          </div>
          <div className="logo-sub">TRAIN · EAT · REST</div>
          <button className="icon-btn header-btn" onClick={() => setView({ name: 'plan' })} aria-label="プランとプロフィール">
            <UserIcon size={19} />
          </button>
        </header>
      )}
      <main className="app-main">{overlay ? renderView() : renderTab()}</main>
      {!overlay && (
        <nav className="tabbar">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
              <Icon size={22} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}
