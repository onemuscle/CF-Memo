#!/usr/bin/env node
/**
 * cfm — Claude Code (とあなた) が VITALOG のデータベースを読み書きするためのコマンド
 *
 *   npm run cfm -- context              今の状態のまとめ (Claude Code がセッション開始時に読む)
 *   npm run cfm -- add strength_sets date=2026-11-17 movement="Back Squat" weight_kg=120 reps=5
 *   npm run cfm -- batch items.json     複数件をまとめて登録 (全部成功か全部失敗)
 *   npm run cfm -- list sleep_logs --from 2026-11-01
 *   npm run cfm -- update <entity> <id> key=value ...
 *   npm run cfm -- delete <entity> <id> --yes   (ゴミ箱へ。戻せる)
 *   npm run cfm -- schema [entity]      記録できる項目の一覧
 *   npm run cfm -- summary --period week [--date YYYY-MM-DD]
 *   npm run cfm -- report-save --period week --from ... --to ... --title "..." --file report.md
 *   npm run cfm -- profile [get | set <key> <value>]
 *   npm run cfm -- export [--out backups/xxx.json]
 *   npm run cfm -- import <file> [--dry-run]
 *   npm run cfm -- meta | doctor
 *
 * 接続先とトークン: 環境変数 CFM_URL / CFM_TOKEN、または .cfm.json ({"url": "...", "token": "..."})。
 * .cfm.json は .gitignore 済み。トークンを含むので絶対にコミットしない。
 * 日付は日本時間 (CFM_TZ で変更可) で解釈する。
 */
process.env.TZ = process.env.CFM_TZ ?? 'Asia/Tokyo'

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import {
  addDays,
  goalProgress,
  liftSummaries,
  loadStatus,
  nutritionByDay,
  periodSummary,
  readiness,
  targetFor,
  todayISO,
  weekStart,
  weeklyRate,
  movingAverage,
  dailyValues,
  durationLabel,
  paceLabel,
  type Bundle,
  type PeriodSummary,
} from '../shared/analytics.ts'
import { ENTITIES, entity, type EntityDef } from '../shared/schema.ts'
import { validate } from '../shared/validate.ts'
import { convertLegacy, LEGACY_FORMAT } from '../shared/legacy.ts'
import { runImport } from '../shared/importer.ts'

// ---------- 接続 ----------

interface Conf {
  url: string
  token?: string
  accessId?: string
  accessSecret?: string
}

function conf(): Conf {
  let file: Partial<Conf> = {}
  const p = new URL('../.cfm.json', import.meta.url)
  if (existsSync(p)) file = JSON.parse(readFileSync(p, 'utf8'))
  const url = (process.env.CFM_URL ?? file.url ?? '').replace(/\/$/, '')
  if (!url) die('接続先が未設定です。CFM_URL を設定するか、.cfm.json に {"url": "https://..."} を書いてください (docs/05-claude-integration.md)')
  return {
    url,
    token: process.env.CFM_TOKEN ?? file.token,
    accessId: process.env.CF_ACCESS_CLIENT_ID ?? file.accessId,
    accessSecret: process.env.CF_ACCESS_CLIENT_SECRET ?? file.accessSecret,
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const c = conf()
  const headers: Record<string, string> = { 'User-Agent': 'cfm-cli' }
  // トークン未設定なら付けない (クラウド環境ではプロキシが Authorization を付与する)
  if (c.token) headers.Authorization = `Bearer ${c.token}`
  if (c.accessId && c.accessSecret) {
    headers['CF-Access-Client-Id'] = c.accessId
    headers['CF-Access-Client-Secret'] = c.accessSecret
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(c.url + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  const text = await res.text()
  let json: unknown
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    die(`サーバーの応答が JSON ではありません (HTTP ${res.status})。Cloudflare Access のログイン画面に止められている可能性: docs/05-claude-integration.md`)
  }
  if (!res.ok) {
    const j = json as { error?: string; details?: unknown; errors?: unknown }
    die(`HTTP ${res.status}: ${j?.error ?? text}\n${j?.details || j?.errors ? JSON.stringify(j.details ?? j.errors, null, 2) : ''}`)
  }
  return json as T
}

function die(msg: string): never {
  console.error(`✖ ${msg}`)
  process.exit(1)
}

// ---------- 引数 ----------

function parseArgs(argv: string[]) {
  const pos: string[] = []
  const flags: Record<string, string | true> = {}
  const kv: Record<string, unknown> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=')
      if (v !== undefined) flags[k] = v
      else if (argv[i + 1] && !argv[i + 1].startsWith('--') && !argv[i + 1].includes('=')) flags[k] = argv[++i]
      else flags[k] = true
    } else if (/^[a-z_0-9]+=/.test(a)) {
      const idx = a.indexOf('=')
      const k = a.slice(0, idx)
      const raw = a.slice(idx + 1)
      kv[k] = raw === '' ? null : /^[[{]/.test(raw) ? JSON.parse(raw) : raw
    } else pos.push(a)
  }
  return { pos, flags, kv }
}

function needEntity(name: string | undefined): EntityDef {
  const d = name ? entity(name) : undefined
  if (!d) die(`記録の種類を指定してください: ${Object.keys(ENTITIES).join(', ')}`)
  return d
}

// ---------- context ----------

const fmtMin = (m: number | null) => (m == null ? '—' : `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, '0')}`)

function summaryMd(s: PeriodSummary): string {
  const lines = [
    `- セッション ${s.sessions}回 (${Object.entries(s.sessionsByType).map(([k, v]) => `${k} ${v}`).join(', ') || 'なし'}) / 運動 ${s.trainingMin}分 / 負荷 ${s.load}`,
    `- 有酸素距離: ${Object.entries(s.cardioKm).map(([k, v]) => `${k} ${v}km`).join(', ') || 'なし'}`,
    `- 睡眠 平均 ${fmtMin(s.avgSleepMin)} (${s.sleepNights}日分) / 疲労 平均 ${s.avgFatigue ?? '—'}/5`,
    `- 体重 平均 ${s.avgWeight ?? '—'}kg (期間内 ${s.weightChange != null ? (s.weightChange > 0 ? '+' : '') + s.weightChange : '—'}kg)`,
    `- 栄養 平均 ${s.avgKcal ?? '—'}kcal / P ${s.avgProtein ?? '—'}g (${s.nutritionDays}日分)`,
  ]
  if (s.prs.length) lines.push(`- 自己ベスト: ${s.prs.map(p => `${p.date.slice(5)} ${p.movement} ${p.kind === 'e1rm' ? `e1RM ${p.value}` : `${p.reps}RM ${p.value}`}kg`).join(' / ')}`)
  if (s.skillUpdates.length) lines.push(`- スキル: ${s.skillUpdates.map(k => `${k.date.slice(5)} ${k.skill} ${k.level}${k.maxUnbroken != null ? ` 連続${k.maxUnbroken}` : ''}`).join(' / ')}`)
  return lines.join('\n')
}

async function context(days: number) {
  const today = todayISO()
  const b = await call<Bundle>('GET', `/api/bundle?from=${addDays(today, -400)}&reports=1`)
  const rows = (n: string) => (b.data[n] ?? []) as Record<string, unknown>[]
  const out: string[] = []
  out.push(`# VITALOG コンテキスト (${today} 時点・日本時間)`, '')
  out.push('## プロフィール・方針 (DB の profile)')
  const prof = Object.entries(b.profile)
  if (!prof.length) out.push('- 未登録。ユーザーに確認して `cfm profile set` で保存すること')
  for (const [k, v] of prof) out.push(`- **${k}**: ${String(typeof v === 'string' ? v : JSON.stringify(v)).replace(/\n/g, ' / ')}`)

  out.push('', '## 目標')
  const goals = rows('goals').filter(g => !g.status || g.status === 'active')
  if (!goals.length) out.push('- 登録なし')
  for (const g of goals) {
    const p = goalProgress(b, g, today)
    out.push(`- [P${g.priority ?? '-'}] ${g.title} — 現在 ${p.currentLabel} / 目標 ${g.target_value ?? '—'}${g.unit ?? ''} (${g.target_date ?? '期限なし'}) / 達成率 ${p.pct ?? '—'}% / 到達予想 ${p.projectedDate ?? '—'}${p.onTrack === false ? ' ⚠期限に間に合わないペース' : ''}`)
  }

  out.push('', '## 今日のコンディション')
  const rd = readiness(b, today)
  out.push(`- 目安スコア ${rd.score ?? '—'} (${rd.level}) ${rd.components.map(c => `${c.label} ${c.value}`).join(' / ')}`)
  for (const a of rd.advice) out.push(`- ${a}`)
  const ls = loadStatus(b, today)
  out.push(`- 負荷: 直近7日 ${ls.acute7} / 週平均(28日) ${ls.chronic28} / 負荷比 ${ls.acwr ?? '—'} (${ls.zone})`)

  const inj = rows('injuries').filter(i => i.status !== 'resolved')
  out.push('', '## 怪我・不調 (未解決)')
  if (!inj.length) out.push('- なし')
  for (const i of inj) out.push(`- ${i.body_part} (${i.status}, ${i.started_on}〜) ${i.description ?? ''}${i.avoid ? ` 避ける: ${i.avoid}` : ''}`)

  out.push('', `## 直近${days}日のまとめ`)
  out.push(summaryMd(periodSummary(b, addDays(today, -(days - 1)), today)))
  const ws = weekStart(today)
  out.push('', `## 今週 (${ws}〜)`, summaryMd(periodSummary(b, ws, addDays(ws, 6))))

  out.push('', '## 主要リフト (推定1RMベスト・最近の記録)')
  const lifts = liftSummaries(rows('strength_sets')).slice(0, 12)
  if (!lifts.length) out.push('- 記録なし')
  for (const L of lifts) {
    const rms = [1, 3, 5].filter(r => L.repMaxes[r]).map(r => `${r}RM ${L.repMaxes[r].weight}`).join(', ')
    out.push(`- ${L.movement}: e1RM ${L.bestE1rm ?? '—'}kg (${L.bestE1rmDate ?? '—'}) ${rms ? `/ ${rms}` : ''} / 最終 ${L.lastDate}`)
  }

  out.push('', '## 体組成・栄養')
  const avg = movingAverage(dailyValues(rows('body_metrics'), 'weight_kg'))
  const rate = weeklyRate(avg, today)
  out.push(`- 体重7日平均 ${avg.length ? avg[avg.length - 1].value : '—'}kg / ペース ${rate ? `${rate.perWeek}kg/週` : '—'}`)
  const t = targetFor(rows('nutrition_targets'), today)
  out.push(`- 現在の栄養目標: ${t ? `${t.phase} ${t.kcal}kcal P${t.protein_g} F${t.fat_g} C${t.carbs_g} (${t.start_date}〜)` : '未設定'}`)
  const nut = nutritionByDay(rows('nutrition_entries')).filter(d => d.date >= addDays(today, -6))
  out.push(`- 直近7日の食事記録: ${nut.length}日分 ${nut.map(d => `${d.date.slice(5)} ${d.kcal ?? '—'}kcal P${d.protein_g ?? '—'}`).join(' / ')}`)
  const sups = rows('supplements').filter(s => s.active !== 0)
  if (sups.length) out.push(`- サプリ: ${sups.map(s => `${s.name} ${s.dose ?? ''}`).join(', ')}`)

  out.push('', `## 直近7日の記録`)
  for (let k = 6; k >= 0; k--) {
    const d = addDays(today, -k)
    const items: string[] = []
    for (const w of rows('workouts').filter(r => r.date === d)) items.push(`${w.type} ${w.title ?? ''} ${w.result ? `→ ${w.result}` : ''} ${w.rpe ? `RPE${w.rpe}` : ''}${w.duration_min ? ` ${w.duration_min}分` : ''}`.trim())
    for (const s of rows('strength_sets').filter(r => r.date === d)) items.push(`${s.movement} ${s.weight_kg}kg×${s.reps}${s.sets && Number(s.sets) > 1 ? `×${s.sets}` : ''}`)
    for (const c of rows('cardio_sessions').filter(r => r.date === d)) items.push(`${c.modality} ${c.distance_m ? `${Number(c.distance_m) / 1000}km` : ''} ${durationLabel(c.duration_s as number)} ${c.pace_s_per_km ? paceLabel(c.pace_s_per_km as number) : ''} ${c.avg_hr ? `HR${c.avg_hr}` : ''}`.trim())
    for (const s of rows('sleep_logs').filter(r => r.date === d)) items.push(`睡眠 ${fmtMin(s.duration_min as number)}`)
    for (const w of rows('wellness').filter(r => r.date === d)) items.push(`疲労${w.fatigue ?? '-'} 筋肉痛${w.soreness ?? '-'}`)
    out.push(`- ${d}: ${items.join(' / ') || '記録なし'}`)
  }

  out.push('', '## 記録の抜け (データ不足)')
  const gaps: string[] = []
  const has = (n: string, d = 7) => rows(n).some(r => String(r.date ?? r.start_date) >= addDays(today, -d))
  if (!has('body_metrics')) gaps.push('体重: 直近7日なし')
  if (!has('sleep_logs')) gaps.push('睡眠: 直近7日なし')
  if (!has('nutrition_entries')) gaps.push('食事: 直近7日なし')
  if (!has('wellness')) gaps.push('コンディション: 直近7日なし')
  if (!rows('goals').length) gaps.push('目標: 未登録')
  if (!t) gaps.push('栄養目標: 未設定')
  out.push(gaps.length ? gaps.map(g => `- ${g}`).join('\n') : '- 特になし')

  const reports = rows('reports').sort((a, z) => String(z.end_date).localeCompare(String(a.end_date)))
  if (reports.length) out.push('', '## 最新のコーチレポート', `- ${reports[0].title} (${reports[0].start_date}〜${reports[0].end_date})`)
  console.log(out.join('\n'))
}

// ---------- main ----------

const [cmd, ...rest] = process.argv.slice(2)
const { pos, flags, kv } = parseArgs(rest)

switch (cmd) {
  case 'context':
    await context(Number(flags.days ?? 28))
    break
  case 'schema': {
    const list = pos[0] ? [needEntity(pos[0])] : (Object.values(ENTITIES) as unknown as EntityDef[])
    for (const d of list) {
      console.log(`\n## ${d.name} (${d.label})${d.uniqueBy ? ` — ${d.uniqueBy.join('+')} が同じなら既存の行に追記` : ''}`)
      for (const f of d.fields) {
        if (f.computed) continue
        const extra = f.type === 'enum' ? ` [${f.options!.map(o => `${o[0]}=${o[1]}`).join(', ')}]` : f.min != null || f.max != null ? ` (${f.min ?? ''}〜${f.max ?? ''})` : ''
        console.log(`- ${f.name}: ${f.type}${f.required ? ' 必須' : ''}${f.unit ? ` [${f.unit}]` : ''} — ${f.label}${extra}`)
      }
    }
    break
  }
  case 'add': {
    const d = needEntity(pos[0])
    const v = validate(d.name as never, kv)
    if (!v.ok) die(`入力エラー:\n${v.errors.join('\n')}`)
    if (flags['dry-run']) {
      console.log(JSON.stringify(v.values, null, 2))
      break
    }
    const r = await call<{ row: Record<string, unknown>; status: string }>('POST', `/api/e/${d.name}`, { ...kv, id: kv.id ?? crypto.randomUUID() })
    console.log(`✔ ${r.status === 'merged' ? '既存の行に追記' : r.status === 'unchanged' ? '登録済み (変更なし)' : '登録'}: ${d.label} id=${r.row.id}`)
    console.log(JSON.stringify(r.row))
    break
  }
  case 'batch': {
    const src = pos[0] === '-' || !pos[0] ? readFileSync(0, 'utf8') : readFileSync(pos[0], 'utf8')
    const j = JSON.parse(src) as { items: { entity: string; data: Record<string, unknown> }[] }
    const items = (Array.isArray(j) ? j : j.items).map(it => ({ ...it, data: { ...it.data, id: it.data.id ?? crypto.randomUUID() } }))
    const errs = items.flatMap((it, i) => {
      if (!entity(it.entity)) return [`#${i} 不明な種類 ${it.entity}`]
      const v = validate(it.entity as never, it.data)
      return v.ok ? [] : v.errors.map(e => `#${i} ${it.entity}: ${e}`)
    })
    if (errs.length) die(`入力エラー (何も保存していません):\n${errs.join('\n')}`)
    if (flags['dry-run']) {
      console.log(`検証OK: ${items.length}件 (未保存)`)
      break
    }
    const r = await call<{ results: { entity: string; status: string; row: { id: string } }[] }>('POST', '/api/batch', { items })
    for (const x of r.results) console.log(`✔ ${x.entity} ${x.status} id=${x.row.id}`)
    break
  }
  case 'list': {
    const d = needEntity(pos[0])
    const q = new URLSearchParams()
    for (const k of ['from', 'to', 'limit', 'deleted']) if (typeof flags[k] === 'string') q.set(k, flags[k] as string)
    for (const [k, v] of Object.entries(kv)) q.set(k, String(v))
    const r = await call<{ rows: Record<string, unknown>[] }>('GET', `/api/e/${d.name}?${q}`)
    for (const row of r.rows) console.log(JSON.stringify(Object.fromEntries(Object.entries(row).filter(([, v]) => v != null))))
    console.error(`(${r.rows.length}件)`)
    break
  }
  case 'update': {
    const d = needEntity(pos[0])
    if (!pos[1]) die('id を指定してください')
    const v = validate(d.name as never, kv, { partial: true })
    if (!v.ok) die(`入力エラー:\n${v.errors.join('\n')}`)
    const r = await call<{ row: unknown }>('PATCH', `/api/e/${d.name}/${pos[1]}`, kv)
    console.log('✔ 更新', JSON.stringify(r.row))
    break
  }
  case 'delete': {
    const d = needEntity(pos[0])
    if (!pos[1]) die('id を指定してください')
    if (!flags.yes) die('削除にはユーザーの確認が必要です。確認済みなら --yes を付けてください (ゴミ箱に移るだけで、あとから戻せます)')
    await call('DELETE', `/api/e/${d.name}/${pos[1]}`)
    console.log('✔ ゴミ箱に移動しました (restore で戻せます)')
    break
  }
  case 'restore': {
    const d = needEntity(pos[0])
    await call('POST', `/api/e/${d.name}/${pos[1]}/restore`)
    console.log('✔ 元に戻しました')
    break
  }
  case 'summary': {
    const date = (flags.date as string) ?? todayISO()
    const period = (flags.period as string) ?? 'week'
    let from: string
    let to: string
    if (period === 'week') {
      from = weekStart(date)
      to = addDays(from, 6)
    } else if (period === 'month') {
      from = date.slice(0, 8) + '01'
      const [y, m] = date.split('-').map(Number)
      to = `${date.slice(0, 8)}${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
    } else if (period === 'year') {
      from = date.slice(0, 4) + '-01-01'
      to = date.slice(0, 4) + '-12-31'
    } else {
      from = flags.from as string
      to = (flags.to as string) ?? date
    }
    const b = await call<Bundle>('GET', `/api/bundle?from=${addDays(from, -400)}&to=${to}`)
    const s = periodSummary(b, from, to)
    console.log(`# ${from}〜${to}\n${summaryMd(s)}\n\n(JSON)\n${JSON.stringify(s)}`)
    break
  }
  case 'report-save': {
    for (const k of ['period', 'from', 'to', 'title', 'file']) if (typeof flags[k] !== 'string') die(`--${k} が必要です`)
    const body = readFileSync(flags.file as string, 'utf8')
    const r = await call<{ row: { id: string } }>('POST', '/api/e/reports', {
      id: crypto.randomUUID(),
      period: flags.period,
      start_date: flags.from,
      end_date: flags.to,
      title: flags.title,
      body_md: body,
      source: 'agent',
    })
    console.log(`✔ レポートを保存しました id=${r.row.id} (Webアプリの 分析 → レポート で見られます)`)
    break
  }
  case 'profile': {
    if (pos[0] === 'set') {
      if (!pos[1] || pos[2] === undefined) die('使い方: profile set <key> <value>')
      await call('PUT', `/api/profile/${pos[1]}`, { value: pos.slice(2).join(' ') })
      console.log(`✔ profile.${pos[1]} を保存`)
    } else {
      const r = await call<{ profile: Record<string, unknown> }>('GET', '/api/profile')
      console.log(JSON.stringify(r.profile, null, 2))
    }
    break
  }
  case 'export': {
    const c = conf()
    const headers: Record<string, string> = {}
    if (c.token) headers.Authorization = `Bearer ${c.token}`
    const res = await fetch(`${c.url}/api/export`, { headers })
    if (!res.ok) die(`HTTP ${res.status}`)
    const text = await res.text()
    const out = (flags.out as string) ?? `backups/cf-memo-backup-${todayISO()}.json`
    mkdirSync(out.split('/').slice(0, -1).join('/') || '.', { recursive: true })
    writeFileSync(out, text)
    console.log(`✔ ${out} (${Math.round(text.length / 1024)}KB) — backups/ は .gitignore 済み。健康データなのでコミットしないこと`)
    break
  }
  case 'import': {
    if (!pos[0]) die('ファイルを指定してください')
    const j = JSON.parse(readFileSync(pos[0], 'utf8'))
    const payload = j.format === LEGACY_FORMAT ? (() => {
      const c = convertLegacy(j)
      console.log(c.summary.join('\n'))
      return { tables: c.tables, attachments: c.attachments }
    })() : { tables: j.tables, profile: j.profile, attachments: j.attachments }
    const r = await runImport(payload, (p, body) => call('POST', p, body), { dryRun: !!flags['dry-run'], onProgress: (d, t) => process.stderr.write(`\r${d}/${t}`) })
    console.log(`\n${flags['dry-run'] ? '【確認のみ】' : ''}追加 ${r.inserted} / 更新 ${r.updated} / 変更なし ${r.skipped} / 写真 ${r.attachments} / エラー ${r.errors.length}`)
    for (const e of r.errors.slice(0, 20)) console.log(`  ${e}`)
    break
  }
  case 'meta':
    console.log(JSON.stringify(await call('GET', '/api/meta'), null, 2))
    break
  case 'doctor': {
    const c = conf()
    console.log(`接続先: ${c.url}`)
    console.log(`トークン: ${c.token ? '設定あり' : '未設定 (プロキシ注入を想定)'}`)
    const h = await fetch(`${c.url}/api/health`).then(r => r.status).catch(e => `接続失敗 ${e.message}`)
    console.log(`稼働確認 /api/health: ${h}`)
    const me = await call<{ actor: string; kind: string }>('GET', '/api/me')
    console.log(`認証: OK (${me.kind}/${me.actor})`)
    break
  }
  default:
    console.log(readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\*?/, '').replace(/^ \* ?/gm, ''))
}
