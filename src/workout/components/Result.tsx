import { useMemo, useState } from 'react'
import { swapItem, type Block, type Item, type Workout } from '../engine'
import { CONDITION_LABEL, ENV_LABEL, GEAR_LABEL, GOAL_LABEL, LEVEL_LABEL, isAway } from '../engine/labels'
import { newSeed } from '../engine/rng'
import { loadOneRm, saveOneRm, type Current } from '../storage'
import { track } from '../track'
import ShareMenu from './ShareMenu'
import Timer, { RestTimer, unlockAudio } from './Timer'
import { BackIcon, ChevronIcon, PlayIcon, ShuffleIcon, SwapIcon, TimerIcon, VideoIcon } from './Icons'

interface Props {
  current: Current
  shared: boolean
  shareUrl: string
  onChange: (c: Current) => void
  onRegenerate: () => void
  onEdit: () => void
  onHome: () => void
  onFinish: () => void
}

const KIND_COLOR: Record<Block['kind'], string> = {
  warmup: '#ffd23f',
  strength: '#ff5c8a',
  main: 'var(--accent)',
  wod: 'var(--accent)',
  accessory: '#7aa7ff',
  finisher: '#ff9d3f',
  cooldown: '#5fd4c8',
}

export function setKey(block: Block, i: number) {
  return `${block.key}:${i}`
}

/** 消化したセット数と全セット数 */
export function progressOf(w: Workout, done: Record<string, number>) {
  let total = 0
  let finished = 0
  for (const b of w.blocks) {
    b.items.forEach((it, i) => {
      if (!it.sets) return
      total += it.sets
      finished += Math.min(it.sets, done[setKey(b, i)] ?? 0)
    })
  }
  return { total, finished }
}

export default function Result({ current, shared, shareUrl, onChange, onRegenerate, onEdit, onHome, onFinish }: Props) {
  const w = current.workout
  const a = w.answers
  const [timerBlock, setTimerBlock] = useState<Block>()
  const [rest, setRest] = useState<{ seconds: number; label: string; key: number }>()
  const [oneRm, setOneRm] = useState(loadOneRm)
  const [showWhy, setShowWhy] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const { total, finished } = progressOf(w, current.done)

  function setDone(block: Block, i: number, n: number) {
    const item = block.items[i]
    const prev = current.done[setKey(block, i)] ?? 0
    onChange({
      ...current,
      startedAt: current.startedAt ?? Date.now(),
      done: { ...current.done, [setKey(block, i)]: n },
    })
    // セットを終えたら休憩タイマー (スーパーセットの1種目目は restSec がなく、休憩なしでペアへ)
    if (n > prev && item.restSec) {
      unlockAudio()
      const pairSecond = !!item.tag && /2$/.test(item.tag)
      const nextName =
        n < (item.sets ?? 0) ? (pairSecond ? block.items[i - 1]?.name : item.name) : block.items[i + 1]?.name ?? '次のブロック'
      setRest({ seconds: item.restSec, label: nextName ?? item.name, key: Date.now() })
    }
  }

  function swap(block: Block, i: number) {
    const next = swapItem(w, block.key, i, newSeed())
    if (!next) return
    track('swap_exercise', { from: block.items[i].id })
    onChange({ ...current, workout: next, done: { ...current.done, [setKey(block, i)]: 0 } })
  }

  function updateOneRm(lift: string, kg: number | undefined) {
    saveOneRm(lift, kg)
    setOneRm(loadOneRm())
  }

  const timeline = useMemo(() => w.blocks.map(b => ({ key: b.key, label: b.label, minutes: b.minutes, color: KIND_COLOR[b.kind] })), [w])

  return (
    <div className={`result env-${a.env}`}>
      <header className="result-top">
        <button className="icon-btn" onClick={onHome} aria-label="ホームへ">
          <BackIcon size={22} />
        </button>
        <span className="brand-sm">KYOTORE</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setShareOpen(true)}>
          共有
        </button>
      </header>

      {shared && (
        <div className="shared-banner">
          <div>
            <strong>シェアされたメニューです</strong>
            <span>あなたの目的・時間・体調に合わせたメニューも30秒で作れます</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={onEdit}>
            自分用に作る
          </button>
        </div>
      )}

      <section className="hero-card">
        <div className="hero-kicker">
          TODAY'S {a.env === 'box' ? 'WOD' : 'WORKOUT'} · {w.totalMinutes} MIN
        </div>
        <h1 className="hero-title">{w.title}</h1>
        <p className="hero-subtitle">{w.subtitle}</p>
        <div className="chips">
          <span className="chip">{ENV_LABEL[a.env]}</span>
          {isAway(a.env) && <span className="chip">{a.gear.length ? a.gear.map(g => GEAR_LABEL[g]).join('・') : '道具なし'}</span>}
          {a.quiet && <span className="chip">静かに</span>}
          <span className="chip">{GOAL_LABEL[a.goal]}</span>
          <span className="chip">{w.focusLabel}</span>
          <span className="chip">{LEVEL_LABEL[a.level]}</span>
          <span className="chip">{CONDITION_LABEL[a.condition]}</span>
        </div>

        <div className="timeline" aria-label="時間配分">
          {timeline.map(t => (
            <div key={t.key} className="timeline-seg" style={{ flexGrow: t.minutes, background: t.color }} title={`${t.label} ${t.minutes}分`} />
          ))}
        </div>
        <div className="timeline-legend">
          {timeline.map(t => (
            <span key={t.key}>
              <i style={{ background: t.color }} />
              {t.label} {t.minutes}分
            </span>
          ))}
        </div>

        <div className="hero-actions">
          <button className="btn btn-ghost btn-sm" onClick={onRegenerate}>
            <ShuffleIcon size={16} /> 別のメニュー
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onEdit}>
            条件を変える
          </button>
        </div>
      </section>

      <section className="coach-card">
        <button className="coach-head" onClick={() => setShowWhy(v => !v)} aria-expanded={showWhy}>
          <span className="coach-avatar" aria-hidden>
            T
          </span>
          <span className="coach-title">トレーナーの解説: このメニューにした理由</span>
          <span className={`chev ${showWhy ? 'open' : ''}`}>
            <ChevronIcon size={18} />
          </span>
        </button>
        {showWhy && (
          <ul className="coach-list">
            {w.why.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        )}
        {w.cautions.length > 0 && (
          <div className="caution">
            {w.cautions.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </div>
        )}
      </section>

      {w.blocks.map(b => (
        <BlockCard
          key={b.key}
          block={b}
          done={current.done}
          score={current.scores?.[b.key]}
          oneRm={oneRm}
          onSet={(i, n) => setDone(b, i, n)}
          onSwap={i => swap(b, i)}
          onTimer={() => {
            unlockAudio()
            track('open_timer', { block: b.kind })
            setTimerBlock(b)
          }}
          onOneRm={updateOneRm}
        />
      ))}

      <section className="next-card">
        <h2>次回へのアドバイス</h2>
        <ul>
          {w.next.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </section>

      <p className="disclaimer">
        体調や痛みに不安がある場合は無理をせず、医師・専門家に相談してください。重量はあくまで目安です。
      </p>

      <div className="finish-bar">
        <div className="finish-progress">
          <div className="finish-progress-text">
            {total > 0 ? (
              <>
                <strong>{finished}</strong>/{total} セット
              </>
            ) : (
              'メニューを順番にこなそう'
            )}
          </div>
          <div className="finish-progress-bar">
            <div style={{ width: `${total ? (finished / total) * 100 : 0}%` }} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={onFinish}>
          完了する
        </button>
      </div>

      {rest && <RestTimer key={rest.key} seconds={rest.seconds} label={rest.label} onClose={() => setRest(undefined)} />}

      {timerBlock?.timer && (
        <Timer
          spec={timerBlock.timer}
          title={timerBlock.title}
          lines={timerBlock.items.map(i => `${i.name}  ${i.prescription}`)}
          onClose={score => {
            if (score && (timerBlock.kind === 'wod' || timerBlock.timer?.type === 'amrap' || timerBlock.timer?.type === 'fortime')) {
              onChange({ ...current, scores: { ...current.scores, [timerBlock.key]: score } })
            }
            setTimerBlock(undefined)
          }}
        />
      )}

      {shareOpen && <ShareMenu workout={w} url={shareUrl} onClose={() => setShareOpen(false)} />}
    </div>
  )
}

interface BlockProps {
  block: Block
  done: Record<string, number>
  score?: string
  oneRm: Record<string, number>
  onSet: (i: number, n: number) => void
  onSwap: (i: number) => void
  onTimer: () => void
  onOneRm: (lift: string, kg: number | undefined) => void
}

function BlockCard({ block, done, score, oneRm, onSet, onSwap, onTimer, onOneRm }: BlockProps) {
  const bookend = block.kind === 'warmup' || block.kind === 'cooldown'
  return (
    <section className={`block block-${block.kind}`} style={{ ['--k' as string]: KIND_COLOR[block.kind] }}>
      <div className="block-head">
        <span className="block-label">{block.label}</span>
        <span className="block-min">{block.minutes}分</span>
      </div>
      <h2 className="block-title">{block.title}</h2>
      {block.format && <p className="block-format">{block.format}</p>}

      {block.timer && (
        <button className={`btn ${bookend ? 'btn-ghost' : 'btn-accent'} btn-sm block-timer`} onClick={onTimer}>
          {bookend ? <PlayIcon size={16} /> : <TimerIcon size={16} />}
          {bookend ? 'ガイド付きで開始' : 'タイマーを開く'}
        </button>
      )}
      {score && <div className="block-score">スコア: {score}</div>}

      <ol className="items">
        {block.items.map((it, i) => (
          <ItemRow
            key={`${it.id}-${i}`}
            item={it}
            compact={bookend}
            done={done[setKey(block, i)] ?? 0}
            oneRm={it.percent ? oneRm[it.percent.lift] : undefined}
            onSet={n => onSet(i, n)}
            onSwap={() => onSwap(i)}
            onOneRm={onOneRm}
          />
        ))}
      </ol>

      {block.tips && block.tips.length > 0 && (
        <ul className="block-tips">
          {block.tips.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

interface ItemProps {
  item: Item
  compact: boolean
  done: number
  oneRm?: number
  onSet: (n: number) => void
  onSwap: () => void
  onOneRm: (lift: string, kg: number | undefined) => void
}

function roundPlate(kg: number) {
  return Math.round(kg / 2.5) * 2.5
}

function ItemRow({ item, compact, done, oneRm, onSet, onSwap, onOneRm }: ItemProps) {
  const [open, setOpen] = useState(false)
  const complete = !!item.sets && done >= item.sets
  const video = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${item.name} やり方`)}`

  return (
    <li className={`item ${complete ? 'complete' : ''} ${compact ? 'item-compact' : ''}`}>
      <div className="item-main">
        {item.tag && <span className="item-tag">{item.tag}</span>}
        <div className="item-body">
          <div className="item-name">
            {item.name}
            {item.en && !compact && <span className="item-en">{item.en}</span>}
          </div>
          <div className="item-rx">{item.prescription}</div>
          {item.detail && <div className="item-detail">{item.detail}</div>}

          {item.percent && (
            <div className="onerm">
              <label>
                1RM
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="kg"
                  defaultValue={oneRm ?? ''}
                  onBlur={e => onOneRm(item.percent!.lift, Number(e.target.value) || undefined)}
                />
                kg
              </label>
              {oneRm ? (
                <span className="onerm-out">
                  → <strong>{roundPlate((oneRm * item.percent.lo) / 100)}〜{roundPlate((oneRm * item.percent.hi) / 100)}kg</strong>
                </span>
              ) : (
                <span className="onerm-hint">入れると使用重量を計算</span>
              )}
            </div>
          )}

          {item.variants && (
            <div className="variants">
              {item.variants.map(v => (
                <span key={v.label} className={`variant ${v.label === item.recommended ? 'rec' : ''}`}>
                  <b>
                    {v.label === item.recommended && '★ '}
                    {v.label}
                  </b>
                  {v.text}
                </span>
              ))}
            </div>
          )}
        </div>
        {!compact && (item.cues?.length || item.swappable) && (
          <button className={`icon-btn chev ${open ? 'open' : ''}`} onClick={() => setOpen(o => !o)} aria-label="フォームのポイント" aria-expanded={open}>
            <ChevronIcon size={18} />
          </button>
        )}
      </div>

      {open && (
        <div className="item-more">
          {item.cues && (
            <ul className="cues">
              {item.cues.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
          <div className="item-links">
            <a className="btn btn-ghost btn-sm" href={video} target="_blank" rel="noopener noreferrer">
              <VideoIcon size={16} /> 動画で確認
            </a>
            {item.swappable && (
              <button className="btn btn-ghost btn-sm" onClick={onSwap}>
                <SwapIcon size={16} /> 別の種目に変える
              </button>
            )}
          </div>
        </div>
      )}

      {!!item.sets && (
        <div className="sets" aria-label="セットの記録">
          {Array.from({ length: item.sets }, (_, s) => (
            <button
              key={s}
              className={`set ${s < done ? 'on' : ''}`}
              onClick={() => onSet(s < done && s === done - 1 ? s : s + 1)}
              aria-label={`${s + 1}セット目${s < done ? ' (完了)' : ''}`}
            >
              {s + 1}
            </button>
          ))}
        </div>
      )}
    </li>
  )
}
