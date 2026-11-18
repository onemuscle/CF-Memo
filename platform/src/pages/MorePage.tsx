import { useEffect, useState } from 'react'
import { ENTITY_NAMES, entity } from '../../../shared/schema.ts'
import { convertLegacy, LEGACY_FORMAT, type LegacyExport } from '../../../shared/legacy.ts'
import { countRows, runImport, type ImportPayload } from '../../../shared/importer.ts'
import { api, discardOutbox, flushOutbox, outboxCount, type Row } from '../api.ts'
import { Card, Empty, Segmented, toast } from '../components/ui.tsx'
import { rowTitle, useData } from '../data.tsx'

type Tab = 'profile' | 'backup' | 'trash' | 'history' | 'connect'

export default function MorePage() {
  const [tab, setTab] = useState<Tab>('profile')
  return (
    <div className="page">
      <header className="page-head">
        <h1>SETTINGS</h1>
      </header>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          ['profile', 'プロフィール'],
          ['backup', 'データ'],
          ['trash', 'ゴミ箱'],
          ['history', '変更履歴'],
          ['connect', '連携'],
        ]}
      />
      {tab === 'profile' && <Profile />}
      {tab === 'backup' && <Backup />}
      {tab === 'trash' && <Trash />}
      {tab === 'history' && <History />}
      {tab === 'connect' && <Connect />}
    </div>
  )
}

// ---- プロフィール ----

export const PROFILE_FIELDS: { key: string; label: string; long?: boolean; placeholder?: string }[] = [
  { key: 'nickname', label: '呼び名' },
  { key: 'birth_year', label: '生まれ年', placeholder: '1990' },
  { key: 'sex', label: '性別' },
  { key: 'height_cm', label: '身長 (cm)' },
  { key: 'box', label: '所属ボックス・ジム' },
  { key: 'training_history', label: '競技歴・運動歴', long: true },
  { key: 'weekly_schedule', label: '週のスケジュール', long: true, placeholder: '月〜木 朝CrossFit・夜補助 / 金 完全休養 / 土日 CrossFit' },
  { key: 'long_term_goals', label: '長期目標', long: true },
  { key: 'training_policy', label: 'トレーニング方針・判断基準', long: true },
  { key: 'nutrition_policy', label: '食事の方針', long: true },
  { key: 'constraints', label: '制約・注意点 (持病・時間・設備など)', long: true },
]

function Profile() {
  const [vals, setVals] = useState<Record<string, string>>({})
  const [orig, setOrig] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    api.get<{ profile: Record<string, unknown> }>('/api/profile').then(r => {
      const v: Record<string, string> = {}
      for (const [k, x] of Object.entries(r.profile)) v[k] = typeof x === 'string' ? x : JSON.stringify(x)
      setVals(v)
      setOrig(v)
    })
  }, [])
  async function save() {
    setBusy(true)
    try {
      for (const f of PROFILE_FIELDS) {
        if ((vals[f.key] ?? '') !== (orig[f.key] ?? '')) await api.put(`/api/profile/${f.key}`, { value: vals[f.key] ?? '' })
      }
      setOrig(vals)
      toast('保存しました')
    } catch (e) {
      toast((e as Error).message, 'err')
    } finally {
      setBusy(false)
    }
  }
  const extra = Object.keys(vals).filter(k => !PROFILE_FIELDS.some(f => f.key === k))
  return (
    <Card title="プロフィールと方針" action={<span className="muted small">Claude Code が毎回読み込みます</span>}>
      <div className="fields">
        {PROFILE_FIELDS.map(f => (
          <div className={`field ${f.long ? 'wide' : ''}`} key={f.key}>
            <label>{f.label}</label>
            {f.long ? (
              <textarea rows={3} value={vals[f.key] ?? ''} placeholder={f.placeholder} onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))} />
            ) : (
              <input value={vals[f.key] ?? ''} placeholder={f.placeholder} onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))} />
            )}
          </div>
        ))}
      </div>
      {extra.length > 0 && (
        <div className="small muted">
          その他の項目: {extra.map(k => <div key={k}>{k}: {vals[k].slice(0, 120)}</div>)}
        </div>
      )}
      <div className="form-actions">
        <button className="btn primary" onClick={save} disabled={busy}>
          {busy ? '保存中…' : '保存'}
        </button>
      </div>
    </Card>
  )
}

// ---- データ (バックアップ) ----

interface Meta {
  schema_version: number
  migrations: string[]
  counts: Record<string, { n: number; deleted: number | null; last: string | null }>
  audit: { n: number; last: string | null }
  attachments: { n: number; bytes: number }
}

function Backup() {
  const { refresh, pending } = useData()
  const [meta, setMeta] = useState<Meta | null>(null)
  const [file, setFile] = useState<{ name: string; payload: ImportPayload; summary: string[] } | null>(null)
  const [progress, setProgress] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const load = () => api.get<Meta>('/api/meta').then(setMeta)
  useEffect(() => {
    load()
  }, [])

  async function pick(f: File | undefined) {
    if (!f) return
    try {
      const j = JSON.parse(await f.text())
      if (j.format === LEGACY_FORMAT) {
        const c = convertLegacy(j as LegacyExport)
        setFile({ name: f.name, payload: { tables: c.tables, attachments: c.attachments }, summary: ['旧CF MEMO の書き出しファイル', ...c.summary] })
      } else if (j.format === 'cf-memo-platform-export') {
        const counts = Object.entries(j.tables as Record<string, unknown[]>)
          .filter(([, r]) => r.length)
          .map(([k, r]) => `${entity(k)?.label ?? k} ${r.length}件`)
        setFile({
          name: f.name,
          payload: { tables: j.tables, profile: j.profile, attachments: j.attachments },
          summary: [`バックアップ (${String(j.exported_at).slice(0, 10)} 作成・スキーマv${j.schema_version})`, ...counts, `写真 ${j.attachments?.length ?? 0}枚`],
        })
      } else {
        toast('対応していないファイルです', 'err')
      }
    } catch {
      toast('JSON ファイルとして読めませんでした', 'err')
    }
  }

  async function doImport(dryRun: boolean) {
    if (!file) return
    setBusy(true)
    try {
      const r = await runImport(file.payload, (p, b) => api.post(p, b), {
        dryRun,
        onProgress: (d, t) => setProgress(`${d} / ${t}`),
      })
      const msg = `${dryRun ? '【確認のみ・未保存】' : ''}追加 ${r.inserted}・更新 ${r.updated}・変更なし ${r.skipped}${dryRun ? '' : `・写真 ${r.attachments}`}${r.errors.length ? `・エラー ${r.errors.length}` : ''}`
      setProgress(msg + (r.errors.length ? '\n' + r.errors.slice(0, 10).join('\n') : ''))
      if (!dryRun) {
        toast('取り込みました')
        await refresh()
        load()
      }
    } catch (e) {
      setProgress((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const total = meta ? Object.values(meta.counts).reduce((a, c) => a + c.n, 0) : 0
  return (
    <>
      <Card title="データの状態">
        {meta ? (
          <>
            <p className="small">
              記録 <b>{total.toLocaleString()}</b> 件 ・ 写真 {meta.attachments.n} 枚 ({meta.attachments.bytes < 1024 * 1024 ? `${Math.round(meta.attachments.bytes / 1024)}KB` : `${Math.round((meta.attachments.bytes / 1024 / 1024) * 10) / 10}MB`}) ・ 変更履歴 {meta.audit.n} 件
            </p>
            <p className="muted small">
              データベース構造 v{meta.schema_version} (適用済み: {meta.migrations.join(', ')})
            </p>
            <table className="table small">
              <tbody>
                {ENTITY_NAMES.filter(n => meta.counts[n]?.n).map(n => (
                  <tr key={n}>
                    <td>{entity(n)!.label}</td>
                    <td>{meta.counts[n].n}</td>
                    <td className="muted">{meta.counts[n].last?.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="muted">読み込み中…</p>
        )}
        {pending > 0 && (
          <div className="warn-box">
            送信待ちの記録が {pending} 件あります (通信できなかったときの記録)。
            <div className="form-actions">
              <button
                className="btn small"
                onClick={async () => {
                  const r = await flushOutbox()
                  toast(`送信 ${r.sent}件${r.failed.length ? ` / 失敗 ${r.failed.length}件: ${r.failed[0].error}` : ''}`, r.failed.length ? 'warn' : 'ok')
                  refresh()
                }}
              >
                今すぐ送信
              </button>
              <button
                className="btn small danger"
                onClick={() => {
                  if (confirm(`送信待ちの ${outboxCount()} 件を破棄します。元に戻せません。よろしいですか?`)) discardOutbox()
                }}
              >
                破棄
              </button>
            </div>
          </div>
        )}
      </Card>
      <Card title="バックアップを書き出す">
        <p className="small">すべての記録・写真・変更履歴を1つのファイル (JSON) に保存します。月に1回程度、スマホやPCに保存しておくと安心です。</p>
        <p className="muted small">自動のバックアップもあります: Cloudflare の巻き戻し機能 (過去7日・有料プランは30日) と、毎日の暗号化バックアップ (90日保存)。詳しくは docs/OPERATIONS.md。</p>
        <a className="btn primary" href="/api/export" download>
          書き出す (.json)
        </a>
      </Card>
      <Card title="ファイルから取り込む">
        <p className="small">このアプリのバックアップ、または旧 CF MEMO の書き出しファイルを取り込めます。既存の記録は消えません (新しいものだけ追加・更新)。</p>
        <label className="btn ghost">
          ファイルを選ぶ
          <input type="file" accept="application/json,.json" hidden onChange={e => pick(e.target.files?.[0])} />
        </label>
        {file && (
          <div className="import-box">
            <b>{file.name}</b>
            <ul className="plain small">
              {file.summary.map(s => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p className="muted small">合計 {countRows(file.payload)} 件</p>
            <div className="form-actions">
              <button className="btn" disabled={busy} onClick={() => doImport(true)}>
                確認だけする
              </button>
              <button className="btn primary" disabled={busy} onClick={() => doImport(false)}>
                取り込む
              </button>
            </div>
          </div>
        )}
        {progress && <pre className="progress-log">{progress}</pre>}
      </Card>
    </>
  )
}

// ---- ゴミ箱 ----

function Trash() {
  const { refresh } = useData()
  const [items, setItems] = useState<{ name: string; row: Row }[] | null>(null)
  const load = async () => {
    const all = await Promise.all(ENTITY_NAMES.map(n => api.get<{ rows: Row[] }>(`/api/e/${n}?deleted=1&limit=200`).then(r => r.rows.map(row => ({ name: n, row })))))
    setItems(all.flat().sort((a, b) => String(b.row.deleted_at).localeCompare(String(a.row.deleted_at))))
  }
  useEffect(() => {
    load()
  }, [])
  async function restore(name: string, id: string) {
    try {
      await api.post(`/api/e/${name}/${id}/restore`)
      toast('元に戻しました')
      await load()
      refresh()
    } catch (e) {
      toast((e as Error).message, 'err')
    }
  }
  return (
    <Card title="ゴミ箱" action={<span className="muted small">削除した記録は自動では消えません</span>}>
      {!items ? (
        <p className="muted">読み込み中…</p>
      ) : items.length === 0 ? (
        <Empty>ゴミ箱は空です</Empty>
      ) : (
        items.map(({ name, row }) => (
          <div className="entry static" key={row.id}>
            <span className="tag">{entity(name)!.label}</span>
            <span className="entry-title">{rowTitle(name, row)}</span>
            <span className="entry-note">削除: {String(row.deleted_at).slice(0, 16).replace('T', ' ')}</span>
            <button className="btn small" onClick={() => restore(name, row.id)}>
              戻す
            </button>
          </div>
        ))
      )}
    </Card>
  )
}

// ---- 変更履歴 ----

interface Audit {
  seq: number
  at: string
  actor: string
  action: string
  table_name: string
  row_id: string
  before: string | null
  after: string | null
}

const ACTION: Record<string, string> = { create: '追加', update: '変更', merge: '追記', delete: '削除', restore: '復元', import: '取り込み' }

function History() {
  const { refresh } = useData()
  const [rows, setRows] = useState<Audit[] | null>(null)
  const load = () => api.get<{ rows: Audit[] }>('/api/audit?limit=100').then(r => setRows(r.rows))
  useEffect(() => {
    load()
  }, [])
  async function revert(a: Audit) {
    if (!confirm(`#${a.seq}「${ACTION[a.action] ?? a.action}」を取り消して、その直前の状態に戻します。よろしいですか? (この操作自体も履歴に残ります)`)) return
    try {
      await api.post(`/api/audit/${a.seq}/revert`)
      toast('取り消しました')
      load()
      refresh()
    } catch (e) {
      toast((e as Error).message, 'err')
    }
  }
  const label = (t: string) => ENTITY_NAMES.map(n => entity(n)!).find(d => d.table === t)?.label ?? t
  return (
    <Card title="変更履歴 (直近100件)">
      {!rows ? (
        <p className="muted">読み込み中…</p>
      ) : (
        rows.map(a => {
          let summary = ''
          try {
            const after = a.after ? JSON.parse(a.after) : null
            const before = a.before ? JSON.parse(a.before) : null
            const name = ENTITY_NAMES.find(n => entity(n)!.table === a.table_name)
            if (name && (after?.id || before?.id)) summary = rowTitle(name, (after ?? before) as Row)
          } catch {
            /* 表示だけなので無視 */
          }
          const revertable = ['create', 'update', 'merge', 'delete', 'restore', 'import'].includes(a.action) && a.table_name !== 'profile' && a.table_name !== 'attachments' && !a.row_id.includes(',')
          return (
            <div className="audit" key={a.seq}>
              <div>
                <span className="muted small">
                  #{a.seq} {a.at.slice(0, 16).replace('T', ' ')} ・ {a.actor}
                </span>
                <div>
                  <b>{ACTION[a.action] ?? a.action}</b> {label(a.table_name)} {summary && <span className="muted">— {summary}</span>}
                </div>
              </div>
              {revertable && (
                <button className="btn small ghost" onClick={() => revert(a)}>
                  取り消す
                </button>
              )}
            </div>
          )
        })
      )}
    </Card>
  )
}

// ---- 連携 ----

function Connect() {
  return (
    <>
      <Card title="Claude Code から記録する">
        <p className="small">
          Claude Code のチャットで「今日はスクワット120kgを5回できた」のように報告すると、Claude Code が内容を整理してこのデータベースに保存します。仕組みと設定は
          リポジトリの <code>docs/05-claude-integration.md</code> にあります。
        </p>
      </Card>
      <Card title="Apple Watch / ヘルスケア">
        <p className="small">
          iPhone の「ショートカット」アプリで、ヘルスケアの睡眠・安静時心拍・HRV・歩数を毎朝自動で送れます。手順は <code>docs/apple-health.md</code> にあります。
        </p>
        <p className="muted small">送り先: このサイトの /api/e/daily_health と /api/e/sleep_logs (API トークンが必要)</p>
      </Card>
    </>
  )
}
