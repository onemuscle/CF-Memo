import { useEffect, useRef, useState } from 'react'
import Tesseract from 'tesseract.js'
import {
  API_KEY_SETTING,
  QUALITY_SETTING,
  QUALITY_TIERS,
  checkApiKey,
  qualityOf,
  transcribeWod,
  wodToText,
  type Quality,
  type WodDraft,
} from '../ai'
import { deleteSetting, getSetting, putMemo, putSetting, putWod } from '../db'
import { saveImageFile } from '../images'
import { formatDate, newId, today, type Memo, type ScannedWod } from '../types'
import { CameraIcon } from './Icons'
import { WOD_SAVED_EVENT } from './TodayPage'

interface Props {
  onSaved: (memoId: string) => void
}

type Phase = 'pick' | 'ready' | 'ocr' | 'edit'

const CONFIDENCE_LABEL: Record<WodDraft['confidence'], string> = {
  high: '読み取り良好',
  medium: '一部あいまい',
  low: '自信なし・要確認',
}

const emptyDraft = (): WodDraft => ({
  title: '',
  format: '',
  movements: [],
  notes: '',
  raw: '',
  confidence: 'low',
  source: 'manual',
})

export default function WodScan({ onSaved }: Props) {
  const [phase, setPhase] = useState<Phase>('pick')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>()
  const [progress, setProgress] = useState(0)
  const [draft, setDraft] = useState<WodDraft>(emptyDraft)
  const [date, setDate] = useState(today())
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [result, setResult] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [apiKey, setApiKey] = useState('')
  const [quality, setQuality] = useState<Quality>('standard')
  const [keyInput, setKeyInput] = useState('')
  const [keyOpen, setKeyOpen] = useState(false)
  const [keyStatus, setKeyStatus] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getSetting(API_KEY_SETTING).then(v => setApiKey(v ?? ''))
    getSetting(QUALITY_SETTING).then(v => setQuality(qualityOf(v)))
  }, [])

  function pickQuality(q: Quality) {
    setQuality(q)
    // 品質はタップした時点で保存する。「確認して保存」を押す必要はない
    putSetting(QUALITY_SETTING, q)
    setKeyStatus(`読み取りの品質を「${QUALITY_TIERS[q].label}」にしました。`)
  }

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function pick(f: File | null) {
    if (!f) return
    setFile(f)
    setDraft(emptyDraft())
    setText('')
    setResult('')
    setError('')
    setDate(today())
    setTitle('')
    setPhase('ready')
  }

  function applyDraft(d: WodDraft) {
    setDraft(d)
    setText(wodToText(d))
    setTitle(d.title || `WOD ${formatDate(date)}`)
    setPhase('edit')
  }

  /** Claudeで読み取る。キー未設定なら呼ばれない */
  async function runClaude() {
    if (!file) return
    setPhase('ocr')
    setProgress(0)
    setError('')
    try {
      const d = await transcribeWod(file, apiKey, quality)
      applyDraft(d)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : '読み取りに失敗しました。')
      setPhase('ready')
    }
  }

  /** 端末内OCR。オフライン用の控え。手書きはほぼ読めない */
  async function runTesseract() {
    if (!file) return
    setPhase('ocr')
    setProgress(0)
    setError('')
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
      applyDraft({ ...emptyDraft(), raw: data.text.trim(), source: 'tesseract' })
    } catch (err) {
      console.error(err)
      setError('端末内OCRに失敗しました。')
      setPhase('ready')
    }
  }

  async function saveKey() {
    const v = keyInput.trim()
    if (!v) return
    setKeyStatus('確認中…')
    try {
      await checkApiKey(v)
      await putSetting(API_KEY_SETTING, v)
      setApiKey(v)
      setKeyInput('')
      setKeyStatus('保存しました。')
      setKeyOpen(false)
    } catch (err) {
      console.error(err)
      setKeyStatus('このキーでは接続できませんでした。')
    }
  }

  async function clearKey() {
    await deleteSetting(API_KEY_SETTING)
    setApiKey('')
    setKeyStatus('削除しました。')
  }

  async function handleSave() {
    if (!file) return
    setSaving(true)
    try {
      const imageId = await saveImageFile(file)
      const now = Date.now()
      const body = result.trim()
        ? `${text.trim()}\n\n▶ RESULT: ${result.trim()}`
        : text.trim()
      const memo: Memo = {
        id: newId(),
        category: 'wod',
        title: title.trim() || `WOD ${formatDate(date)}`,
        body,
        tags: ['wod'],
        imageIds: [imageId],
        createdAt: now,
        updatedAt: now,
      }
      await putMemo(memo)

      // 「今日」タブのAMカードはこの日付で引く
      const wod: ScannedWod = {
        ...draft,
        date,
        title: title.trim(),
        raw: text.trim(),
        result: result.trim(),
        imageId,
        memoId: memo.id,
        updatedAt: now,
      }
      await putWod(wod)
      window.dispatchEvent(new Event(WOD_SAVED_EVENT))

      reset()
      onSaved(memo.id)
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setFile(null)
    setDraft(emptyDraft())
    setText('')
    setResult('')
    setError('')
    setPhase('pick')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="page">
      <div className="scan-intro">
        <h2 className="scan-title">WOD SCAN</h2>
        <p className="scan-sub">
          ホワイトボードのWOD画像を読み取り、保存するとその日の「今日」タブに反映されます。
          結果は保存前に自由に編集できます。
        </p>
      </div>

      {phase === 'pick' && (
        <>
          <button className="scan-drop" onClick={() => fileRef.current?.click()}>
            <CameraIcon size={36} />
            <span>WODの画像を撮影 / 選択</span>
          </button>

          <ApiKeyPanel
            apiKey={apiKey}
            open={keyOpen}
            setOpen={setKeyOpen}
            keyInput={keyInput}
            setKeyInput={setKeyInput}
            status={keyStatus}
            quality={quality}
            onPickQuality={pickQuality}
            onSave={saveKey}
            onClear={clearKey}
          />
        </>
      )}

      {previewUrl && phase !== 'pick' && (
        <img className="scan-preview" src={previewUrl} alt="WOD画像" />
      )}

      {error && <p className="scan-error">{error}</p>}

      {phase === 'ready' && (
        <div className="scan-actions">
          {apiKey ? (
            <>
              <button className="btn-primary wide" onClick={runClaude}>
                読み取る ({QUALITY_TIERS[quality].label} · {QUALITY_TIERS[quality].cost})
              </button>
              <button className="btn-ghost wide" onClick={runTesseract}>
                端末内OCRで読み取る (オフライン)
              </button>
            </>
          ) : (
            <>
              <p className="scan-hint">
                高精度の読み取りにはAPIキーの設定が必要です。未設定のまま進むと端末内OCRになります。
              </p>
              <button className="btn-primary wide" onClick={() => setKeyOpen(true)}>
                APIキーを設定する
              </button>
              <button className="btn-ghost wide" onClick={runTesseract}>
                端末内OCRで読み取る
              </button>
            </>
          )}
          <button className="btn-ghost wide" onClick={reset}>
            画像を選び直す
          </button>
          {!apiKey && (
            <ApiKeyPanel
              apiKey={apiKey}
              open={keyOpen}
              setOpen={setKeyOpen}
              keyInput={keyInput}
              setKeyInput={setKeyInput}
              status={keyStatus}
              quality={quality}
              onPickQuality={pickQuality}
              onSave={saveKey}
              onClear={clearKey}
            />
          )}
        </div>
      )}

      {phase === 'ocr' && (
        <div className="scan-progress">
          <div className="progress-track">
            <div
              className={`progress-fill${progress === 0 ? ' indeterminate' : ''}`}
              style={progress > 0 ? { width: `${Math.round(progress * 100)}%` } : undefined}
            />
          </div>
          <p>{progress > 0 ? `解析中… ${Math.round(progress * 100)}%` : '読み取り中…'}</p>
          <p className="empty-sub">
            {progress > 0
              ? '初回は認識モデルのダウンロードに少し時間がかかります。'
              : '手書きの文字を読み取っています。10〜20秒ほどかかります。'}
          </p>
        </div>
      )}

      {phase === 'edit' && (
        <>
          <p className={`scan-hint${draft.confidence === 'high' ? '' : ' warn'}`}>
            {draft.source === 'tesseract'
              ? '⚠ 端末内OCRは手書きに弱いため、内容を必ず確認してください。'
              : `読み取り: ${CONFIDENCE_LABEL[draft.confidence]}。保存前に確認・修正してください。`}
          </p>

          {draft.movements.length > 0 && (
            <div className="wod-movements">
              {draft.movements.map((m, i) => (
                <div className="wod-move" key={`${m.name}-${i}`}>
                  <span className="wod-move-name">
                    {m.name}
                    {m.nameJa && <span className="wod-move-ja">{m.nameJa}</span>}
                  </span>
                  <span className="wod-move-rx">
                    {[m.reps, m.load].filter(Boolean).join(' / ')}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="scan-note">
            <strong>保存するまで「今日」タブには入りません。</strong>
            下の「保存して…」を押すと、指定した日のWODとして記録されます。
          </p>

          <label className="field-label" htmlFor="wod-date">
            日付
          </label>
          <input
            id="wod-date"
            className="input"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />

          <label className="field-label" htmlFor="wod-title">
            タイトル
          </label>
          <input
            id="wod-title"
            className="input"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />

          <label className="field-label" htmlFor="wod-text">
            WODの内容 (編集可能)
          </label>
          <textarea
            id="wod-text"
            className="input textarea"
            rows={10}
            value={text}
            onChange={e => setText(e.target.value)}
          />

          <label className="field-label" htmlFor="wod-result">
            自分の記録 (任意)
          </label>
          <input
            id="wod-result"
            className="input"
            placeholder="例: 12:34 RX / 5R+7 / 80kg"
            value={result}
            onChange={e => setResult(e.target.value)}
          />

          <div className="scan-actions">
            <button className="btn-primary wide" onClick={handleSave} disabled={saving}>
              {saving ? '保存中…' : `保存して ${formatDate(date)} の「今日」に反映`}
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

function ApiKeyPanel({
  apiKey,
  open,
  setOpen,
  keyInput,
  setKeyInput,
  status,
  quality,
  onPickQuality,
  onSave,
  onClear,
}: {
  apiKey: string
  open: boolean
  setOpen: (v: boolean) => void
  keyInput: string
  setKeyInput: (v: string) => void
  status: string
  quality: Quality
  onPickQuality: (q: Quality) => void
  onSave: () => void
  onClear: () => void
}) {
  return (
    <div className="key-panel">
      <button className="key-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>読み取りの設定</span>
        <span className="key-state">
          {apiKey ? QUALITY_TIERS[quality].label : '未設定'}
        </span>
      </button>

      {open && (
        <div className="key-body">
          <p className="fine">
            手書きのホワイトボードは端末内OCRではほとんど読めません。Anthropic の APIキーを
            設定すると、画像をそのまま読み取って種目・回数・重量まで取り出します。
          </p>
          <p className="fine">
            キーは<strong>この端末のブラウザ内だけ</strong>に保存され、GitHubにもサーバーにも
            送信されません。ブラウザのサイトデータを消すと一緒に消えます。
          </p>
          {apiKey && (
            <>
              <label className="field-label">読み取りの品質</label>
              <div className="chip-row">
                {(Object.keys(QUALITY_TIERS) as Quality[]).map(q => (
                  <button
                    key={q}
                    className={`chip ${q === quality ? 'chip-on' : ''}`}
                    onClick={() => onPickQuality(q)}
                  >
                    {QUALITY_TIERS[q].label}
                  </button>
                ))}
              </div>
              <p className="fine">
                <strong>選ぶとその場で保存されます。</strong>
                {QUALITY_TIERS[quality].label} — {QUALITY_TIERS[quality].cost}（
                {QUALITY_TIERS[quality].model}）。
                {quality === 'eco' &&
                  'いちばん安い代わりに読み間違いが増えます。同じ写真を標準と見比べて決めてください。'}
                {quality === 'standard' && '普段はこれで十分です。読めないボードだけ高精度に上げてください。'}
                {quality === 'best' && '標準で読めなかったボード用です。'}
              </p>
            </>
          )}

          <label className="field-label" htmlFor="api-key">
            Anthropic APIキー
          </label>
          <input
            id="api-key"
            className="input"
            type="password"
            autoComplete="off"
            placeholder={apiKey ? '変更するときだけ入力' : 'sk-ant-...'}
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
          />
          {status && <p className="fine">{status}</p>}

          <div className="scan-actions">
            {/* 保存済みのキーがあるときは入力欄が空になる。押せないボタンを残すと
                「保存できない」ように見えるので、入力があるときだけ出す */}
            {keyInput.trim() ? (
              <button className="btn-primary wide" onClick={onSave}>
                {apiKey ? '確認して更新' : '確認して保存'}
              </button>
            ) : (
              apiKey && <p className="fine">キーは設定済みです。</p>
            )}
            {apiKey && (
              <button className="btn-ghost wide" onClick={onClear}>
                保存済みのキーを削除
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
