import { useState } from 'react'
import { api } from '../api.ts'

const MAX_EDGE = 1600
const MAX_BYTES = 1_700_000

/**
 * 画像を JPEG に縮小 (D1 の1行2MB制限に収め、通信量も減らす)。
 * WOD のホワイトボードは文字を読むので長辺2400pxまで残す。
 */
export async function shrinkImage(file: File, maxEdge = MAX_EDGE): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bmp.width * scale))
    canvas.height = Math.max(1, Math.round(bmp.height * scale))
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close()
    for (const quality of [0.85, 0.75, 0.6, 0.45]) {
      const blob = await new Promise<Blob>((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('画像の変換に失敗しました'))), 'image/jpeg', quality))
      if (blob.size <= MAX_BYTES) return blob
    }
    throw new Error('画像が大きすぎます')
  } catch {
    return file
  }
}

export default function PhotoInput({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setErr('')
    try {
      const blob = await shrinkImage(file)
      const r = await api.upload<{ id: string }>('/api/attachments', blob)
      onChange(r.id)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="photo-input">
      {value && <img src={`/api/attachments/${value}`} alt="" />}
      <label className="btn ghost small">
        {busy ? 'アップロード中…' : value ? '写真を変える' : '写真を追加'}
        <input type="file" accept="image/*" hidden onChange={e => pick(e.target.files?.[0])} />
      </label>
      {value && (
        <button type="button" className="link-btn" onClick={() => onChange('')}>
          外す
        </button>
      )}
      {err && <div className="errors">{err}</div>}
    </div>
  )
}
