import { listMemos, listPRs, listWods, getImage } from './db'

/**
 * 端末内 (IndexedDB) のデータをすべて1つの JSON ファイルに書き出す。
 * 新しい CF MEMO (Cloudflare 版) の「設定 → データ → ファイルから取り込む」で読み込める。
 * 形式は shared/legacy.ts の LegacyExport。書き出しても端末内のデータは消えない。
 */
export async function exportLegacyData(): Promise<{ memos: number; prs: number; wods: number; images: number }> {
  const [memos, prs, wods] = await Promise.all([listMemos(), listPRs(), listWods()])
  const imageIds = new Set<string>()
  memos.forEach(m => m.imageIds.forEach(id => imageIds.add(id)))
  wods.forEach(w => w.imageId && imageIds.add(w.imageId))
  const images: { id: string; mime: string; data_base64: string; createdAt: number }[] = []
  for (const id of imageIds) {
    const img = await getImage(id)
    if (!img) continue
    const buf = new Uint8Array(await img.blob.arrayBuffer())
    let s = ''
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    images.push({ id, mime: img.blob.type || 'image/jpeg', data_base64: btoa(s), createdAt: img.createdAt })
  }
  const file = {
    format: 'cf-memo-legacy-export',
    version: 1,
    exported_at: new Date().toISOString(),
    memos,
    prs,
    // 画像の id と補助トレ判定は残し、そのほかはそのまま
    wods,
    images,
  }
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cf-memo-legacy-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return { memos: memos.length, prs: prs.length, wods: wods.length, images: images.length }
}
