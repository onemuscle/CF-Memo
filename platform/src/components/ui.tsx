import { useEffect, type ReactNode } from 'react'

export function Card({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, unit, sub, tone }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function Progress({ pct, tone }: { pct: number | null; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className={`progress ${tone ?? ''}`} role="progressbar" aria-valuenow={pct ?? 0} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct ?? 0))}%` }} />
    </div>
  )
}

export function Ring({ value, label, color }: { value: number | null; label: string; color: string }) {
  const r = 34
  const c = 2 * Math.PI * r
  const v = value ?? 0
  return (
    <div className="ring">
      <svg width={84} height={84} viewBox="0 0 84 84">
        <circle cx={42} cy={42} r={r} className="ring-bg" />
        <circle cx={42} cy={42} r={r} stroke={color} className="ring-fg" strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 42 42)" />
      </svg>
      <div className="ring-text">
        <b>{value ?? '—'}</b>
        <span>{label}</span>
      </div>
    </div>
  )
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label={title}>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map(([v, l]) => (
        <button key={v} role="tab" aria-selected={v === value} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

let toastTimer: number | undefined
export function toast(msg: string, tone: 'ok' | 'warn' | 'err' = 'ok') {
  let el = document.getElementById('toast')
  if (!el) {
    el = document.createElement('div')
    el.id = 'toast'
    el.setAttribute('role', 'status')
    document.body.appendChild(el)
  }
  el.textContent = msg
  el.className = `show ${tone}`
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => el!.classList.remove('show'), 2800)
}

/** 簡易 Markdown 表示 (見出し・箇条書き・太字・表)。HTML は解釈しない */
export function Markdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const out: ReactNode[] = []
  let list: string[] = []
  let table: string[][] = []
  const inline = (s: string, k: number) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <b key={`${k}-${i}`}>{part.slice(2, -2)}</b> : part))
  const flush = (k: number) => {
    if (list.length) {
      out.push(
        <ul key={`ul${k}`}>
          {list.map((l, i) => (
            <li key={i}>{inline(l, i)}</li>
          ))}
        </ul>,
      )
      list = []
    }
    if (table.length) {
      const rows = table.filter(r => !r.every(c => /^:?-+:?$/.test(c.trim())))
      out.push(
        <div className="table-wrap" key={`t${k}`}>
          <table>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (i === 0 ? <th key={j}>{inline(c.trim(), j)}</th> : <td key={j}>{inline(c.trim(), j)}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      table = []
    }
  }
  lines.forEach((line, k) => {
    if (/^\s*[-*] /.test(line)) {
      list.push(line.replace(/^\s*[-*] /, ''))
      return
    }
    if (/^\|.*\|\s*$/.test(line)) {
      table.push(line.trim().slice(1, -1).split('|'))
      return
    }
    flush(k)
    const h = line.match(/^(#{1,4}) (.*)/)
    if (h) out.push(h[1].length <= 2 ? <h3 key={k}>{inline(h[2], k)}</h3> : <h4 key={k}>{inline(h[2], k)}</h4>)
    else if (line.trim()) out.push(<p key={k}>{inline(line, k)}</p>)
  })
  flush(lines.length)
  return <div className="md">{out}</div>
}
