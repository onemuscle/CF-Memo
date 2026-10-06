import { useCallback, useEffect, useState } from 'react'
import { decodeShare, exerciseIds, generateForToday, generateWorkout, shareCode, workedMuscles, type Answers, type Rating } from './engine'
import { newSeed } from './engine/rng'
import {
  addHistory,
  loadAnswers,
  loadCurrent,
  loadHistory,
  loadWeeklyGoal,
  removeHistory,
  saveAnswers,
  saveCurrent,
  saveWeeklyGoal,
  type Current,
} from './storage'
import { isoDate, thisWeekCount, weekStreak } from './stats'
import { track } from './track'
import Landing from './components/Landing'
import Quiz from './components/Quiz'
import Result, { progressOf } from './components/Result'
import History from './components/History'
import DoneSheet from './components/DoneSheet'
import Generating from './components/Generating'

type View = 'home' | 'quiz' | 'loading' | 'result' | 'history'

const BASE_TITLE = document.title
// window.history (記録の state 名 history と衝突しないように別名)
const history_ = window.history
const siteUrl = () => `${location.origin}${location.pathname}`

export default function App() {
  const [view, setViewState] = useState<View>('home')
  const [last, setLast] = useState<Answers | null>(loadAnswers)
  const [current, setCurrentState] = useState<Current | null>(loadCurrent)
  const [history, setHistory] = useState(loadHistory)
  const [goal, setGoal] = useState(loadWeeklyGoal)
  const [quizInitial, setQuizInitial] = useState<Partial<Answers>>()
  const [pending, setPending] = useState<Answers>()
  const [shared, setShared] = useState(false)
  const [doneOpen, setDoneOpen] = useState(false)

  const setCurrent = useCallback((c: Current | null) => {
    setCurrentState(c)
    saveCurrent(c)
  }, [])

  // ブラウザの戻るボタンで画面を戻れるようにする
  const setView = useCallback((v: View, replace = false) => {
    setViewState(v)
    const url = v === 'result' ? location.search || location.pathname : location.pathname
    if (replace) history_.replaceState({ view: v }, '', url)
    else history_.pushState({ view: v }, '', url)
    window.scrollTo({ top: 0 })
  }, [])

  useEffect(() => {
    const onPop = (e: PopStateEvent) => setViewState((e.state?.view as View) ?? 'home')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // 共有リンク (?w=...) で開かれたら、そのメニューを表示する
  useEffect(() => {
    const code = new URLSearchParams(location.search).get('w')
    const decoded = code ? decodeShare(code) : undefined
    if (!decoded) {
      history_.replaceState({ view: 'home' }, '', location.pathname)
      return
    }
    const mine = current && shareCode(current.workout) === code
    if (!mine) {
      // 送り手の履歴の要約もURLに入っているので、送り手と同じメニューになる
      setCurrent({ workout: generateWorkout(decoded.answers, decoded.seed, decoded.context), done: {} })
      setShared(true)
      track('open_shared')
    }
    history_.replaceState({ view: 'result' }, '', location.search)
    setViewState('result')
    // 初回の表示時だけ判定する
  }, [])

  // 結果画面のURLを、いま表示しているメニューの共有URLにそろえる
  useEffect(() => {
    if (view === 'result' && current) {
      const code = shareCode(current.workout)
      history_.replaceState({ view: 'result' }, '', `${location.pathname}?w=${code}`)
      document.title = `${current.workout.title} | きょうトレ`
    } else {
      document.title = BASE_TITLE
    }
  }, [view, current])

  function build(a: Answers) {
    saveAnswers(a)
    setLast(a)
    setPending(a)
    setShared(false)
    setView('loading', view === 'quiz')
  }

  function onGenerated() {
    if (!pending) return
    const workout = generateForToday(pending, newSeed(), loadHistory())
    setCurrent({ workout, done: {} })
    track('generate_workout', { env: pending.env, goal: pending.goal, minutes: pending.minutes, level: pending.level, focus: pending.focus.join(',') || 'auto' })
    setPending(undefined)
    setView('result', true)
  }

  function regenerate() {
    if (!current) return
    const a = current.workout.answers
    const workout = shared ? generateWorkout(a, newSeed(), current.workout.context) : generateForToday(a, newSeed(), loadHistory())
    setCurrent({ workout, done: {} })
    track('regenerate_workout')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function save(rating: Rating, score?: string) {
    const w = current!.workout
    addHistory({
      id: w.id,
      date: isoDate(new Date()),
      doneAt: Date.now(),
      title: w.title,
      env: w.answers.env,
      goal: w.answers.goal,
      muscles: workedMuscles(w),
      exerciseIds: exerciseIds(w),
      minutes: w.totalMinutes,
      rating,
      score,
    })
    const h = loadHistory()
    setHistory(h)
    return { total: h.length, week: thisWeekCount(h), goal, streak: weekStreak(h, goal) }
  }

  function goHome() {
    setDoneOpen(false)
    setShared(false)
    setView('home')
  }

  return (
    <div className={`app-shell ${(view === 'result' || doneOpen) && current ? `env-${current.workout.answers.env}` : ''}`}>
      {view === 'home' && (
        <Landing
          last={last}
          current={current}
          history={history}
          goal={goal}
          onStart={() => {
            track('quiz_start')
            setQuizInitial(undefined)
            setView('quiz')
          }}
          onQuick={a => {
            track('quick_generate')
            build(a)
          }}
          onResume={() => setView('result')}
          onHistory={() => setView('history')}
        />
      )}

      {view === 'quiz' && <Quiz initial={quizInitial} onDone={build} onExit={() => setView('home')} />}

      {view === 'loading' && pending && <Generating answers={pending} onDone={onGenerated} />}

      {view === 'result' && current && (
        <Result
          current={current}
          shared={shared}
          shareUrl={`${siteUrl()}?w=${shareCode(current.workout)}`}
          onChange={setCurrent}
          onRegenerate={regenerate}
          onEdit={() => {
            setQuizInitial(shared ? undefined : current.workout.answers)
            setView('quiz')
          }}
          onHome={goHome}
          onFinish={() => {
            track('open_finish')
            setDoneOpen(true)
          }}
        />
      )}

      {view === 'history' && (
        <History
          history={history}
          goal={goal}
          onGoal={n => {
            setGoal(n)
            saveWeeklyGoal(n)
          }}
          onRemove={id => {
            removeHistory(id)
            setHistory(loadHistory())
          }}
          onBack={() => setView('home')}
          onStart={() => setView('quiz')}
        />
      )}

      {doneOpen && current && (
        <DoneSheet
          workout={current.workout}
          initialScore={Object.values(current.scores ?? {})[0]}
          progress={progressOf(current.workout, current.done)}
          siteUrl={siteUrl()}
          onSave={save}
          onClose={() => setDoneOpen(false)}
          onHome={() => {
            setCurrent(null)
            goHome()
          }}
        />
      )}
    </div>
  )
}
