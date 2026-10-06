import { useEffect, useMemo, useRef, useState } from 'react'
import type { Answers } from '../engine'
import { activeSteps, completeAnswers, type Step } from '../quiz'
import { track } from '../track'
import { BackIcon } from './Icons'

interface Props {
  initial?: Partial<Answers>
  onDone: (a: Answers) => void
  onExit: () => void
}

/** 回答を選択肢の値 (文字列) の配列として扱う */
function selected(step: Step, a: Partial<Answers>, touched: Set<string>): string[] {
  const v = a[step.key]
  if (v === undefined) return []
  if (Array.isArray(v)) {
    if (v.length) return v as string[]
    // 空配列 = おまかせ / なし (一度選んだ場合だけ選択状態に見せる)
    return touched.has(step.key) ? [step.options.find(o => o.exclusive)!.value] : []
  }
  if (typeof v === 'boolean') return [v ? 'yes' : 'no']
  return [String(v)]
}

export default function Quiz({ initial, onDone, onExit }: Props) {
  const [a, setA] = useState<Partial<Answers>>(initial ?? {})
  const [touched, setTouched] = useState<Set<string>>(() => new Set(initial ? ['focus', 'injuries', 'gear'] : []))
  const [index, setIndex] = useState(0)
  const timer = useRef<number>()
  const steps = useMemo(() => activeSteps(a), [a])
  const step = steps[Math.min(index, steps.length - 1)]
  const sel = selected(step, a, touched)

  useEffect(() => {
    track('quiz_step', { step: step.key, index })
    window.scrollTo({ top: 0 })
  }, [step.key, index])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  function next(updated: Partial<Answers>) {
    const list = activeSteps(updated)
    if (index + 1 >= list.length) {
      const done = completeAnswers(updated)
      if (done) onDone(done)
    } else {
      setIndex(index + 1)
    }
  }

  function choose(value: string) {
    if (step.multi) {
      const opt = step.options.find(o => o.value === value)!
      let list = sel.filter(v => !step.options.find(o => o.value === v)?.exclusive)
      if (opt.exclusive) list = sel.includes(value) ? [] : [value]
      else list = list.includes(value) ? list.filter(v => v !== value) : [...list, value]
      const values = list.filter(v => !step.options.find(o => o.value === v)?.exclusive)
      setA({ ...a, [step.key]: values })
      setTouched(t => {
        const n = new Set(t)
        if (list.length) n.add(step.key)
        else n.delete(step.key)
        return n
      })
      // 「おまかせ」「なし」はそのまま次へ
      if (opt.exclusive && list.length) {
        const updated = { ...a, [step.key]: [] }
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => next(updated), 220)
      }
      return
    }
    const v = step.key === 'minutes' ? Number(value) : step.key === 'quiet' ? value === 'yes' : value
    const updated = { ...a, [step.key]: v } as Partial<Answers>
    // 場所を変えたら、前の場所で選んだ道具は使わない
    if (step.key === 'env' && v !== a.env) {
      delete updated.gear
      delete updated.quiet
      setTouched(t => {
        const n = new Set(t)
        n.delete('gear')
        return n
      })
    }
    setA(updated)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => next(updated), 220)
  }

  function back() {
    window.clearTimeout(timer.current)
    if (index === 0) onExit()
    else setIndex(index - 1)
  }

  const progress = ((index + 1) / steps.length) * 100

  return (
    <div className={`quiz ${a.env ? `env-${a.env}` : ''}`}>
      <div className="quiz-top">
        <button className="icon-btn" onClick={back} aria-label="戻る">
          <BackIcon size={22} />
        </button>
        <div className="quiz-progress" role="progressbar" aria-valuenow={index + 1} aria-valuemax={steps.length}>
          <div style={{ width: `${progress}%` }} />
        </div>
        <span className="quiz-count">
          {index + 1}/{steps.length}
        </span>
      </div>

      <div className="quiz-body" key={`${step.key}-${index}`}>
        <h1 className="quiz-title">{step.title}</h1>
        {step.sub && <p className="quiz-sub">{step.sub}</p>}

        <div className={`options ${step.layout === 'grid' ? 'options-grid' : ''}`}>
          {step.options.map(o => {
            const on = sel.includes(o.value)
            return (
              <button
                key={o.value}
                className={`option ${on ? 'on' : ''} ${o.exclusive ? 'option-wide' : ''} ${o.desc ? '' : 'option-compact'}`}
                onClick={() => choose(o.value)}
                aria-pressed={on}
              >
                {o.emoji && <span className="option-emoji">{o.emoji}</span>}
                <span className="option-text">
                  <span className="option-label">{o.label}</span>
                  {o.desc && <span className="option-desc">{o.desc}</span>}
                </span>
                {step.multi && <span className={`option-check ${on ? 'on' : ''}`} aria-hidden />}
              </button>
            )
          })}
        </div>
      </div>

      {step.multi && (
        <div className="quiz-footer">
          <button className="btn btn-primary btn-block" disabled={sel.length === 0} onClick={() => next(a)}>
            {sel.length === 0 ? '選んでください' : '次へ'}
          </button>
        </div>
      )}
    </div>
  )
}
