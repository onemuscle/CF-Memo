import { useEffect, useRef, useState } from 'react'
import Tesseract from 'tesseract.js'
import { putMemo } from '../db'
import { saveImageFile } from '../images'
import { newId, today, type Memo } from '../types'
import { CameraIcon } from './Icons'

interface Props {
  onSaved: (memoId: string) => void
}

type Phase = 'pick' | 'ready' | 'ocr' | 'edit'

export default function WodScan({ onSaved }: Props) {
  const [phase, setPhase] = useState<Phase>('pick')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>()
  const [progress, setProgress] = useState(0)
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [result, setResult] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function pick(f: File | null) {
    if (!f) return
    setFile(f)
    setText('')
    setTitle(`WOD ${today()}`)
    setResult('')
    setPhase('ready')
  }

  async function runOCR() {
    if (!file) return
    setPhase('ocr')
    setProgress(0)
    try {
      // OCRアセットはすべてアプリに同梱 (CDN不要・オフライン動作)
      const assetBase = new URL('.', document.baseURI).href
      const { data } = await Tesseract.recognize(file, 'jpn+eng', {
        workerPath: `${assetBase}tesseract/worker.min.js`,
        corePath: `${assetBase}tesseract`,
        langPath: `${assetBase}tessdata`,
        logger: m => {
          if (m.status === 'recognizing text') setProgress(m.progress)
        },
      })
      setText(data.text.trim())
      setPhase('edit')
    } catch (err) {
      console.error(err)
      alert('文字起こしに失敗しました。ネットワーク接続を確認して再試行してください。')
      setPhase('ready')
    }
  }

  async function handleSave() {
    if (!file) return
    setSaving(true)
    try {
      const imageId = await saveImageFile(file)
      const now = Date.now()
      const body = result.trim() ? `${text.trim()}\n\n▶ RESULT: ${result.trim()}` : text.trim()
      const memo: Memo = {
        id: newId(),
        category: 'wod',
        title: title.trim() || `WOD ${today()}`,
        body,
        tags: ['wod'],
        imageIds: [imageId],
        createdAt: now,
        updatedAt: now,
      }
      await putMemo(memo)
      reset()
      onSaved(memo.id)
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setFile(null)
    setText('')
    setResult('')
    setPhase('pick')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="page">
      <div className="scan-intro">
        <h2 className="scan-title">WOD SCAN</h2>
        <p className="scan-sub">
          ホワイトボードのWOD画像から自動で文字起こしします。
          結果は保存前に自由に編集できます。
        </p>
      </div>

      {phase === 'pick' && (
        <button className="scan-drop" onClick={() => fileRef.current?.click()}>
          <CameraIcon size={36} />
          <span>WODの画像を撮影 / 選択</span>
        </button>
      )}

      {previewUrl && phase !== 'pick' && (
        <img className="scan-preview" src={previewUrl} alt="WOD画像" />
      )}

      {phase === 'ready' && (
        <div className="scan-actions">
          <button className="btn-primary wide" onClick={runOCR}>
            文字起こしを開始
          </button>
          <button className="btn-ghost wide" onClick={reset}>
            画像を選び直す
          </button>
        </div>
      )}

      {phase === 'ocr' && (
        <div className="scan-progress">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p>解析中… {Math.round(progress * 100)}%</p>
          <p className="empty-sub">初回は認識モデルのダウンロードに少し時間がかかります。</p>
        </div>
      )}

      {phase === 'edit' && (
        <>
          <p className="scan-hint">
            ⚠ OCRの結果は間違っている場合があります。保存前に確認・修正してください。
          </p>
          <label className="field-label">タイトル</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} />

          <label className="field-label">文字起こし結果 (編集可能)</label>
          <textarea
            className="input textarea"
            rows={10}
            value={text}
            onChange={e => setText(e.target.value)}
          />

          <label className="field-label">自分の記録 (任意)</label>
          <input
            className="input"
            placeholder="例: 12:34 RX / 5R+7 / 80kg"
            value={result}
            onChange={e => setResult(e.target.value)}
          />

          <div className="scan-actions">
            <button className="btn-primary wide" onClick={handleSave} disabled={saving}>
              {saving ? '保存中…' : 'メモとして保存'}
            </button>
            <button className="btn-ghost wide" onClick={reset} disabled={saving}>
              やり直す
            </button>
          </div>
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={e => pick(e.target.files?.[0] ?? null)}
      />
    </div>
  )
}
