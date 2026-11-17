/**
 * 旧 CF MEMO (GitHub Pages 版・端末内保存) の書き出しファイルを、新しいデータ形式に変換する。
 *
 * 旧アプリの「データを書き出す」で作ったファイル (format: cf-memo-legacy-export) が対象。
 * 元の id をそのまま使うので、同じファイルを何度取り込んでも二重登録にならない。
 */

export const LEGACY_FORMAT = 'cf-memo-legacy-export'

export interface LegacyExport {
  format: typeof LEGACY_FORMAT
  version: number
  exported_at: string
  memos: { id: string; category: string; title: string; body: string; tags: string[]; imageIds: string[]; createdAt: number; updatedAt: number }[]
  prs: { id: string; movement: string; weight: number | null; unit: 'kg' | 'lb'; reps: number | null; score: string; date: string; note: string; createdAt: number }[]
  wods: {
    date: string
    title: string
    format: string
    movements: { name: string; nameJa: string; reps: string; load: string }[]
    notes: string
    raw: string
    result: string
    source: string
    advice?: { headline?: string; reason?: string }
    imageId?: string
    memoId?: string
    updatedAt: number
  }[]
  images: { id: string; mime: string; data_base64: string; createdAt: number }[]
}

const iso = (ms: number) => new Date(ms || Date.now()).toISOString()
const day = (ms: number) => {
  const d = new Date(ms || Date.now())
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const safeId = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 64)

export interface ConvertedLegacy {
  tables: Record<string, Record<string, unknown>[]>
  attachments: { id: string; mime: string; size: number; data_base64: string; caption: null; source: string; created_at: string; updated_at: string; deleted_at: null }[]
  summary: string[]
}

export function convertLegacy(src: LegacyExport): ConvertedLegacy {
  const journal: Record<string, unknown>[] = []
  const strength: Record<string, unknown>[] = []
  const workouts: Record<string, unknown>[] = []
  const imageIds = new Set(src.images.map(i => i.id))

  for (const m of src.memos ?? []) {
    journal.push({
      id: safeId(m.id),
      date: day(m.createdAt),
      category: ['wod', 'meal', 'rest', 'note'].includes(m.category) ? m.category : 'note',
      title: m.title || '(無題)',
      body: m.body ?? '',
      tags: JSON.stringify(m.tags ?? []),
      attachment_ids: JSON.stringify((m.imageIds ?? []).filter(id => imageIds.has(id)).map(safeId)),
      source: 'legacy',
      created_at: iso(m.createdAt),
      updated_at: iso(m.updatedAt),
    })
  }

  for (const p of src.prs ?? []) {
    const note = [p.note, p.score ? `スコア: ${p.score}` : ''].filter(Boolean).join(' / ')
    if (p.weight != null) {
      const kg = p.unit === 'lb' ? Math.round(p.weight * 0.45359237 * 10) / 10 : p.weight
      strength.push({
        id: safeId(p.id),
        date: p.date,
        movement: p.movement,
        weight_kg: kg,
        reps: p.reps ?? 1,
        is_test: true,
        note: [`旧PR記録${p.reps == null ? ' (回数の記録なし→1回として取り込み)' : ''}${p.unit === 'lb' ? ` (${p.weight}lb)` : ''}`, note].filter(Boolean).join(' / '),
        source: 'legacy',
        created_at: iso(p.createdAt),
        updated_at: iso(p.createdAt),
      })
    } else {
      workouts.push({
        id: safeId(p.id),
        date: p.date,
        type: 'crossfit',
        title: p.movement,
        result: p.score || null,
        note: ['旧PR記録', p.note].filter(Boolean).join(' / '),
        source: 'legacy',
        created_at: iso(p.createdAt),
        updated_at: iso(p.createdAt),
      })
    }
  }

  for (const w of src.wods ?? []) {
    const lines = (w.movements ?? []).map(m => [m.reps, m.name, m.nameJa ? `(${m.nameJa})` : '', m.load].filter(Boolean).join(' '))
    workouts.push({
      id: safeId(`wod-${w.date}`),
      date: w.date,
      type: 'crossfit',
      time_of_day: 'am',
      title: w.title || 'WOD',
      format: w.format || null,
      description: [...lines, w.notes].filter(Boolean).join('\n') || w.raw || null,
      result: w.result || null,
      attachment_id: w.imageId && imageIds.has(w.imageId) ? safeId(w.imageId) : null,
      note: [w.advice?.headline ? `補助トレ判定: ${w.advice.headline}` : '', w.raw ? `ボード原文:\n${w.raw}` : ''].filter(Boolean).join('\n') || null,
      source: 'legacy',
      created_at: iso(w.updatedAt),
      updated_at: iso(w.updatedAt),
    })
  }

  const attachments = (src.images ?? []).map(i => ({
    id: safeId(i.id),
    mime: i.mime || 'image/jpeg',
    size: Math.floor((i.data_base64.length * 3) / 4),
    data_base64: i.data_base64,
    caption: null,
    source: 'legacy',
    created_at: iso(i.createdAt),
    updated_at: iso(i.createdAt),
    deleted_at: null,
  }))

  return {
    tables: { journal, strength_sets: strength, workouts },
    attachments,
    summary: [`メモ ${journal.length}件 → ノート`, `PR記録 ${strength.length}件 → 筋力セット`, `WOD・スコア ${workouts.length}件 → トレーニング`, `写真 ${attachments.length}枚`],
  }
}
