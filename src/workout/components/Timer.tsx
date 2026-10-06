import { useEffect, useMemo, useRef, useState } from 'react'
import type { TimerSpec } from '../engine'
import { CloseIcon, PauseIcon, PlayIcon, SkipIcon } from './Icons'

// ---------------- 音とバイブ ----------------

let audio: AudioContext | undefined

/** ユーザー操作の中で呼んで AudioContext を有効にしておく (iOS対策) */
export function unlockAudio() {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    // 音が出せない環境でもタイマーは動かす
  }
}

export function beep(long = false) {
  try {
    if (!audio) return
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = long ? 1046 : 784
    gain.gain.setValueAtTime(0.0001, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.4, audio.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + (long ? 0.6 : 0.18))
    osc.connect(gain).connect(audio.destination)
    osc.start()
    osc.stop(audio.currentTime + (long ? 0.65 : 0.2))
    navigator.vibrate?.(long ? 400 : 80)
  } catch {
    // noop
  }
}

/** タイマー中は画面を消さない */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: { release: () => Promise<void> } | undefined
    let cancelled = false
    ;(navigator as Navigator & { wakeLock: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
      .request('screen')
      .then(l => {
        if (cancelled) void l.release()
        else lock = l
      })
      .catch(() => {})
    return () => {
      cancelled = true
      void lock?.release()
    }
  }, [active])
}

// ---------------- 経過時間 ----------------

function useClock(running: boolean) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(performance.now()), 100)
    return () => window.clearInterval(id)
  }, [running])
  return now
}

export function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

interface Seg {
  label: string
  sub?: string
  sec: number
  kind: 'work' | 'rest'
}

function segmentsOf(spec: TimerSpec): { segs: Seg[]; capSec?: number; mode: string } {
  switch (spec.type) {
    case 'amrap':
      return { mode: `AMRAP ${spec.minutes}分`, segs: [{ label: 'AMRAP', sec: spec.minutes * 60, kind: 'work' }] }
    case 'fortime':
      return { mode: 'FOR TIME', capSec: spec.capMinutes * 60, segs: [{ label: 'FOR TIME', sec: spec.capMinutes * 60, kind: 'work' }] }
    case 'emom':
      return {
        mode: `EMOM ${spec.minutes}分`,
        segs: Array.from({ length: spec.minutes }, (_, i) => ({
          label: spec.stations[i % spec.stations.length],
          sub: `${i + 1} / ${spec.minutes} 分`,
          sec: 60,
          kind: spec.stations[i % spec.stations.length] === '休憩' ? 'rest' : 'work',
        })),
      }
    case 'interval': {
      const segs: Seg[] = []
      const labels = spec.label.split(' / ')
      for (let r = 1; r <= spec.rounds; r++) {
        segs.push({ label: labels[(r - 1) % labels.length], sub: `${r} / ${spec.rounds}`, sec: spec.workSec, kind: 'work' })
        if (r < spec.rounds) segs.push({ label: '休憩', sub: `次: ${labels[r % labels.length]}`, sec: spec.restSec, kind: 'rest' })
      }
      const t = (sec: number) => (sec >= 60 && sec % 60 === 0 ? `${sec / 60}分` : `${sec}秒`)
      return { mode: `${t(spec.workSec)} / ${t(spec.restSec)} × ${spec.rounds}`, segs }
    }
    case 'guided':
      return {
        mode: 'ガイド',
        segs: spec.steps.map((s, i) => ({
          label: s.label,
          sub: `${i + 1} / ${spec.steps.length}${spec.steps[i + 1] ? `  次: ${spec.steps[i + 1].label}` : ''}`,
          sec: s.seconds,
          kind: /休憩|次:/.test(s.label) ? 'rest' : 'work',
        })),
      }
  }
}

const PREP = 10

interface Props {
  spec: TimerSpec
  title: string
  /** WOD中に見返せるよう、種目と回数を画面下に出す */
  lines?: string[]
  onClose: (score?: string) => void
}

export default function Timer({ spec, title, lines, onClose }: Props) {
  const { segs, capSec, mode } = useMemo(() => segmentsOf(spec), [spec])
  const total = segs.reduce((s, x) => s + x.sec, 0)
  const [running, setRunning] = useState(false)
  const [started, setStarted] = useState(false)
  const [rounds, setRounds] = useState(0)
  const [finishedAt, setFinishedAt] = useState<number>()
  // 経過時間 = (now - start) - 一時停止の合計 + スキップした秒数
  const startRef = useRef(0)
  const pausedRef = useRef(0)
  const pauseStartRef = useRef(0)
  const skipRef = useRef(0)
  const lastBeep = useRef('')
  const now = useClock(running)
  useWakeLock(running)

  const elapsed = started
    ? ((running ? now : pauseStartRef.current) - startRef.current - pausedRef.current) / 1000 + skipRef.current
    : 0
  const t = elapsed - PREP
  const done = finishedAt !== undefined || (started && t >= total)

  let idx = 0
  let acc = 0
  while (idx < segs.length - 1 && t >= acc + segs[idx].sec) {
    acc += segs[idx].sec
    idx++
  }
  const seg = segs[idx]
  const remaining = t < 0 ? -t : acc + seg.sec - t

  // カウントダウンの電子音 (3・2・1 と切り替わり)
  useEffect(() => {
    if (!running || done) return
    const whole = Math.ceil(remaining)
    const key = `${t < 0 ? 'prep' : idx}:${whole}`
    if (key === lastBeep.current) return
    if (whole <= 3 && whole >= 1 && (t < 0 || capSec === undefined || remaining <= 3)) {
      lastBeep.current = key
      beep(false)
    } else if (t >= 0 && Math.abs(t - acc) < 0.25) {
      lastBeep.current = key
      beep(true)
    }
  }, [running, done, remaining, t, idx, acc, capSec])

  useEffect(() => {
    if (started && t >= total && finishedAt === undefined) {
      setFinishedAt(total)
      setRunning(false)
      beep(true)
    }
  }, [started, t, total, finishedAt])

  function start() {
    unlockAudio()
    if (!started) {
      startRef.current = performance.now()
      setStarted(true)
    } else {
      pausedRef.current += performance.now() - pauseStartRef.current
    }
    setRunning(true)
  }

  function pause() {
    pauseStartRef.current = performance.now()
    setRunning(false)
  }

  function skip() {
    if (t < 0) skipRef.current += -t
    else skipRef.current += acc + seg.sec - t
  }

  function finish() {
    setFinishedAt(Math.max(0, t))
    pause()
    beep(true)
  }

  const score =
    spec.type === 'amrap'
      ? `${rounds}ラウンド`
      : spec.type === 'fortime' && finishedAt !== undefined
        ? finishedAt >= (capSec ?? Infinity)
          ? 'タイムキャップ'
          : mmss(finishedAt)
        : undefined

  const phase = !started || t < 0 ? 'prep' : seg.kind
  const big = !started ? mmss(capSec ?? total) : t < 0 ? String(Math.ceil(-t)) : capSec !== undefined ? mmss(t) : mmss(remaining)
  const progress = started && t >= 0 ? Math.min(1, t / total) : 0

  return (
    <div className={`timer-overlay phase-${done ? 'done' : phase}`} role="dialog" aria-label="タイマー">
      <div className="timer-head">
        <div>
          <div className="timer-mode">{mode}</div>
          <div className="timer-title">{title}</div>
        </div>
        <button className="icon-btn" onClick={() => onClose(done ? score : undefined)} aria-label="閉じる">
          <CloseIcon size={24} />
        </button>
      </div>

      <div className="timer-center">
        {done ? (
          <>
            <div className="timer-label">FINISH!</div>
            <div className="timer-big">{score ?? 'おつかれさま'}</div>
            <p className="timer-note">このまま「閉じる」で記録に反映されます</p>
          </>
        ) : (
          <>
            <div className="timer-label">{!started ? 'タップでスタート' : t < 0 ? 'GET READY' : seg.label}</div>
            <div className="timer-big" aria-live="off">{big}</div>
            <div className="timer-sub">
              {started && t >= 0 && (seg.sub ?? (capSec !== undefined ? `TIME CAP ${mmss(capSec)}` : `残り ${mmss(total - t)}`))}
            </div>
          </>
        )}
        <div className="timer-bar">
          <div style={{ width: `${(done ? 1 : progress) * 100}%` }} />
        </div>
      </div>

      {lines && lines.length > 0 && !done && (spec.type === 'amrap' || spec.type === 'fortime' || spec.type === 'interval') && (
        <ul className="timer-lines">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}

      {spec.type === 'amrap' && started && !done && (
        <div className="timer-rounds">
          <button className="btn btn-ghost" onClick={() => setRounds(r => Math.max(0, r - 1))} aria-label="ラウンドを減らす">
            −
          </button>
          <div>
            <div className="timer-rounds-n">{rounds}</div>
            <div className="timer-rounds-l">ラウンド</div>
          </div>
          <button className="btn btn-primary" onClick={() => setRounds(r => r + 1)}>
            +1 ラウンド
          </button>
        </div>
      )}

      <div className="timer-controls">
        {done ? (
          <button className="btn btn-primary btn-block" onClick={() => onClose(score)}>
            閉じる
          </button>
        ) : (
          <>
            {running ? (
              <button className="btn btn-ghost timer-btn" onClick={pause}>
                <PauseIcon /> 一時停止
              </button>
            ) : (
              <button className="btn btn-primary timer-btn" onClick={start}>
                <PlayIcon /> {started ? '再開' : 'スタート'}
              </button>
            )}
            {spec.type === 'fortime' && started && t >= 0 ? (
              <button className="btn btn-accent timer-btn" onClick={finish}>
                終了 (タイム記録)
              </button>
            ) : (
              started && (
                <button className="btn btn-ghost timer-btn" onClick={skip}>
                  <SkipIcon /> 次へ
                </button>
              )
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** セット間の休憩タイマー (画面下に小さく出る) */
export function RestTimer({ seconds, label, onClose }: { seconds: number; label: string; onClose: () => void }) {
  const [end, setEnd] = useState(() => performance.now() + seconds * 1000)
  const now = useClock(true)
  const left = (end - now) / 1000
  const beeped = useRef(0)

  useEffect(() => {
    const whole = Math.ceil(left)
    if (whole <= 3 && whole >= 1 && beeped.current !== whole) {
      beeped.current = whole
      beep(false)
    }
    if (left <= 0) {
      beep(true)
      onClose()
    }
  }, [left, onClose])

  return (
    <div className="rest-timer" role="status">
      <div className="rest-ring" style={{ ['--p' as string]: Math.max(0, left / seconds) }}>
        <span>{mmss(left + 0.999)}</span>
      </div>
      <div className="rest-text">
        <div className="rest-title">休憩中</div>
        <div className="rest-sub">次: {label}</div>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={() => setEnd(e => e + 15000)}>
        +15秒
      </button>
      <button className="icon-btn" onClick={onClose} aria-label="休憩を終える">
        <CloseIcon size={18} />
      </button>
    </div>
  )
}
