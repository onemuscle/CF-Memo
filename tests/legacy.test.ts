import { test } from 'node:test'
import assert from 'node:assert/strict'
import { convertLegacy, type LegacyExport } from '../shared/legacy.ts'
import { validate } from '../shared/validate.ts'

export const SAMPLE: LegacyExport = {
  format: 'cf-memo-legacy-export',
  version: 1,
  exported_at: '2026-11-17T00:00:00Z',
  memos: [{ id: 'm1', category: 'wod', title: 'Fran', body: '4:30', tags: ['benchmark'], imageIds: ['img1'], createdAt: Date.parse('2026-09-01T09:00:00+09:00'), updatedAt: Date.parse('2026-09-01T10:00:00+09:00') }],
  prs: [
    { id: 'p1', movement: 'Push Press', weight: 90, unit: 'kg', reps: 3, score: '', date: '2026-09-02', note: '', createdAt: 1 },
    { id: 'p2', movement: 'Clean', weight: 220, unit: 'lb', reps: null, score: '', date: '2026-09-03', note: 'PR!', createdAt: 2 },
    { id: 'p3', movement: 'Fran', weight: null, unit: 'kg', reps: null, score: '3:58', date: '2026-09-04', note: '', createdAt: 3 },
  ],
  wods: [{ date: '2026-09-05', title: 'Cindy', format: 'AMRAP 20', movements: [{ name: 'Pull-up', nameJa: '懸垂', reps: '5', load: '' }], notes: '', raw: 'AMRAP 20\n5 pull-up', result: '22R', source: 'claude', imageId: 'img1', updatedAt: 5 }],
  images: [{ id: 'img1', mime: 'image/jpeg', data_base64: 'AAAA', createdAt: 1 }],
}

test('旧データの変換: すべて検証を通り、件数が合う', () => {
  const c = convertLegacy(SAMPLE)
  assert.equal(c.tables.journal.length, 1)
  assert.equal(c.tables.strength_sets.length, 2)
  assert.equal(c.tables.workouts.length, 2)
  const clean = c.tables.strength_sets.find(r => r.id === 'p2')!
  assert.equal(clean.weight_kg, 99.8)
  assert.equal(clean.reps, 1)
  for (const [name, rows] of Object.entries(c.tables)) {
    for (const r of rows) {
      const v = validate(name as never, r, { allowMeta: true })
      assert.ok(v.ok, `${name}: ${v.errors.join(', ')}`)
    }
  }
  assert.equal(c.attachments.length, 1)
})
