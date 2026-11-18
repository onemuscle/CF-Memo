import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { daysBetween } from '../../../shared/analytics.ts'

/**
 * 軽量な SVG グラフ (依存ライブラリなし)。
 * - 時間軸は日付。系列ごとに色を固定し、2系列以上は凡例を出す
 * - なぞる/ホバーで縦線とその日の値を表示
 */

export interface Point {
  date: string
  value: number
}
export interface Series {
  name: string
  color: string
  points: Point[]
  dots?: boolean
  line?: boolean
  dashed?: boolean
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(320)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(e => setW(Math.max(200, e[0].contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

const PAD = { l: 40, r: 10, t: 10, b: 22 }

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min]
  const span = max - min
  const step0 = span / count
  const mag = 10 ** Math.floor(Math.log10(step0))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) ?? step0
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000)
  return out
}

function shortDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}`
}

export function LineChart({
  series,
  band,
  height = 180,
  fmt = v => String(Math.round(v * 10) / 10),
  target,
  emptyText = 'まだ記録がありません',
}: {
  series: Series[]
  band?: { date: string; low: number; high: number }[]
  height?: number
  fmt?: (v: number) => string
  target?: { value: number; label: string }
  emptyText?: string
}) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState<string | null>(null)
  const all = series.flatMap(s => s.points)
  const geo = useMemo(() => {
    const dates = [...all.map(p => p.date), ...(band ?? []).map(b => b.date)].sort()
    if (!dates.length) return null
    const d0 = dates[0]
    const d1 = dates[dates.length - 1]
    const span = Math.max(1, daysBetween(d0, d1))
    const vals = [...all.map(p => p.value), ...(band ?? []).flatMap(b => [b.low, b.high]), ...(target ? [target.value] : [])]
    let lo = Math.min(...vals)
    let hi = Math.max(...vals)
    const padV = (hi - lo) * 0.08 || Math.abs(hi) * 0.05 || 1
    lo -= padV
    hi += padV
    const iw = width - PAD.l - PAD.r
    const ih = height - PAD.t - PAD.b
    const x = (d: string) => PAD.l + (daysBetween(d0, d) / span) * iw
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * ih
    const mid = (() => {
      const [y, m, d] = d0.split('-').map(Number)
      const t = new Date(y, m - 1, d + Math.round(span / 2))
      return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    })()
    const xTicks = [d0, ...(span > 20 && iw > 240 ? [mid] : []), d1].filter((d, i, a) => a.indexOf(d) === i)
    return { d0, span, x, y, yTicks: niceTicks(lo, hi), xTicks, iw, dates: [...new Set(dates)] }
  }, [all, band, width, height, target])

  if (!geo) return <div className="chart-empty">{emptyText}</div>

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    let best = geo.dates[0]
    let bd = Infinity
    for (const d of geo.dates) {
      const dist = Math.abs(geo.x(d) - px)
      if (dist < bd) {
        bd = dist
        best = d
      }
    }
    setHover(best)
  }

  const hoverVals = hover
    ? series
        .map(s => ({ s, p: s.points.find(p => p.date === hover) }))
        .filter((x): x is { s: Series; p: Point } => !!x.p)
    : []
  const hoverBand = hover ? band?.find(b => b.date === hover) : undefined
  const tipLeft = hover ? Math.min(Math.max(geo.x(hover) - 70, 0), width - 150) : 0

  return (
    <div className="chart" ref={ref}>
      {series.length > 1 && (
        <div className="legend">
          {series.map(s => (
            <span key={s.name}>
              <i style={{ background: s.color }} className={s.dashed ? 'dashed' : ''} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <svg width={width} height={height} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img">
        {geo.yTicks.map(t => (
          <g key={t}>
            <line x1={PAD.l} x2={width - PAD.r} y1={geo.y(t)} y2={geo.y(t)} className="grid" />
            <text x={PAD.l - 6} y={geo.y(t) + 4} textAnchor="end" className="tick">
              {fmt(t)}
            </text>
          </g>
        ))}
        {geo.xTicks.map((d, i) => (
          <text key={d} x={geo.x(d)} y={height - 6} textAnchor={i === 0 ? 'start' : i === geo.xTicks.length - 1 ? 'end' : 'middle'} className="tick">
            {shortDate(d)}
          </text>
        ))}
        {band && band.length > 1 && (
          <path
            className="band"
            d={
              band.map((b, i) => `${i ? 'L' : 'M'}${geo.x(b.date)},${geo.y(b.high)}`).join('') +
              [...band].reverse().map(b => `L${geo.x(b.date)},${geo.y(b.low)}`).join('') +
              'Z'
            }
          />
        )}
        {target && (
          <g>
            <line x1={PAD.l} x2={width - PAD.r} y1={geo.y(target.value)} y2={geo.y(target.value)} className="target" />
            <text x={width - PAD.r} y={geo.y(target.value) - 4} textAnchor="end" className="tick">
              {target.label}
            </text>
          </g>
        )}
        {series.map(s => (
          <g key={s.name}>
            {s.line !== false && s.points.length > 1 && (
              <path
                d={s.points.map((p, i) => `${i ? 'L' : 'M'}${geo.x(p.date)},${geo.y(p.value)}`).join('')}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dashed ? '5 4' : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {(s.dots || s.points.length === 1) &&
              s.points.map(p => <circle key={p.date} cx={geo.x(p.date)} cy={geo.y(p.value)} r={3} fill={s.color} className="dot" />)}
          </g>
        ))}
        {hover && (
          <g>
            <line x1={geo.x(hover)} x2={geo.x(hover)} y1={PAD.t} y2={height - PAD.b} className="crosshair" />
            {hoverVals.map(({ s, p }) => (
              <circle key={s.name} cx={geo.x(p.date)} cy={geo.y(p.value)} r={4.5} fill={s.color} className="dot-hover" />
            ))}
          </g>
        )}
      </svg>
      {hover && (hoverVals.length > 0 || hoverBand) && (
        <div className="tooltip" style={{ left: tipLeft }}>
          <b>{hover.replace(/-/g, '/')}</b>
          {hoverVals.map(({ s, p }) => (
            <div key={s.name}>
              <i style={{ background: s.color }} />
              {s.name}: <b>{fmt(p.value)}</b>
            </div>
          ))}
          {hoverBand && (
            <div className="muted">
              推定幅 {fmt(hoverBand.low)}〜{fmt(hoverBand.high)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function BarChart({
  bars,
  height = 150,
  fmt = v => String(Math.round(v)),
  target,
  color = 'var(--series-1)',
}: {
  bars: { label: string; value: number | null; color?: string; title?: string }[]
  height?: number
  fmt?: (v: number) => string
  target?: number
  color?: string
}) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...bars.map(b => b.value ?? 0), target ?? 0) * 1.1
  const iw = width - PAD.l - PAD.r
  const ih = height - PAD.t - PAD.b
  const bw = iw / Math.max(1, bars.length)
  const y = (v: number) => PAD.t + (1 - v / max) * ih
  const ticks = niceTicks(0, max, 3)
  const labelEvery = Math.ceil(bars.length / 7)
  if (!bars.some(b => b.value)) return <div className="chart-empty" ref={ref}>まだ記録がありません</div>
  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} onPointerLeave={() => setHover(null)} role="img">
        {ticks.map(t => (
          <g key={t}>
            <line x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" className="tick">
              {fmt(t)}
            </text>
          </g>
        ))}
        {bars.map((b, i) => {
          const h = b.value ? ih - (y(b.value) - PAD.t) : 0
          const x = PAD.l + i * bw + 1
          const w = Math.max(2, bw - 2)
          return (
            <g key={i} onPointerEnter={() => setHover(i)} onClick={() => setHover(i)}>
              <rect x={PAD.l + i * bw} y={PAD.t} width={bw} height={ih} fill="transparent" />
              {h > 0 && <path d={roundedTop(x, y(b.value!), w, h, Math.min(4, w / 2))} fill={b.color ?? color} opacity={hover == null || hover === i ? 1 : 0.55} />}
              {i % labelEvery === 0 && (
                <text x={x + w / 2} y={height - 6} textAnchor="middle" className="tick">
                  {b.label}
                </text>
              )}
            </g>
          )
        })}
        {target != null && <line x1={PAD.l} x2={width - PAD.r} y1={y(target)} y2={y(target)} className="target" />}
      </svg>
      {hover != null && bars[hover] && (
        <div className="tooltip" style={{ left: Math.min(Math.max(PAD.l + hover * bw - 60, 0), width - 150) }}>
          <b>{bars[hover].title ?? bars[hover].label}</b>
          <div>{bars[hover].value != null ? fmt(bars[hover].value!) : '記録なし'}</div>
          {target != null && <div className="muted">目標 {fmt(target)}</div>}
        </div>
      )}
    </div>
  )
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}
