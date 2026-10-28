import { useEffect, useRef, useState } from 'react'
import {
  KEY_SETTING,
  OPENAI_MODELS_SETTING,
  PROVIDER_LABEL,
  PROVIDER_SETTING,
  QUALITY_SETTING,
  QUALITY_TIERS,
  checkApiKey,
  judgeAccessory,
  openAiModelsOf,
  providerOf,
  qualityOf,
  tierInfo,
  transcribeWod,
  wodToText,
  type AiConfig,
  type OpenAiModels,
  type Provider,
  type Quality,
  type WodDraft,
} from '../ai'
import { deleteSetting, getSetting, putMemo, putSetting, putWod } from '../db'
import { saveImageFile } from '../images'
import { formatDate, newId, today, type Memo, type ScannedWod } from '../types'
import { TOP_RULES } from '../plan/planData'
import { GYM_SETTING, exercisesFor, gymLocationOf, planDay } from '../plan/plan'
import AdviceCard from './AdviceCard'
import { CameraIcon } from './Icons'
import { WOD_SAVED_EVENT } from './TodayPage'

interface Props {
  onSaved: (memoId: string) => void
  /** 読み取ったWODから今夜の補助トレを判定する (CF MEMO の12週プラン専用) */
  advise?: boolean
}

type Phase = 'pick' | 'ready' | 'reading' | 'edit'

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

export default function WodScan({ onSaved, advise = true }: Props) {
  const [phase, setPhase] = useState<Phase>('pick')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>()
  const [draft, setDraft] = useState<WodDraft>(emptyDraft)
  const [date, setDate] = useState(today())
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [result, setResult] = useState('')
  const [saving, setSaving] = useState(false)
  const [judging, setJudging] = useState(false)
  /** advice がどの日付のプランに対する判定か。日付を変えたら出し直せるようにする */
  const [advisedDate, setAdvisedDate] = useState('')
  const [error, setError] = useState('')

  const [provider, setProvider] = useState<Provider>('anthropic')
  const [keys, setKeys] = useState<Record<Provider, string>>({ anthropic: '', openai: '' })
  const [openaiModels, setOpenaiModels] = useState<OpenAiModels>(() => openAiModelsOf(undefined))
  const [quality, setQuality] = useState<Quality>('standard')
  const [keyInput, setKeyInput] = useState('')
  const [keyOpen, setKeyOpen] = useState(false)
  const [keyStatus, setKeyStatus] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  /** 文字を読み取らずに写真だけで保存するところ */
  const photoOnly = phase === 'edit' && draft.source === 'manual'

  const apiKey = keys[provider]
  const ai: AiConfig = { provider, apiKey, openaiModels }

  useEffect(() => {
    getSetting(PROVIDER_SETTING).then(v => setProvider(providerOf(v)))
    getSetting(KEY_SETTING.anthropic).then(v => setKeys(k => ({ ...k, anthropic: v ?? '' })))
    getSetting(KEY_SETTING.openai).then(v => setKeys(k => ({ ...k, openai: v ?? '' })))
    getSetting(OPENAI_MODELS_SETTING).then(v => setOpenaiModels(openAiModelsOf(v)))
    getSetting(QUALITY_SETTING).then(v => setQuality(qualityOf(v)))
  }, [])

  function pickProvider(p: Provider) {
    setProvider(p)
    setKeyInput('')
    // 使うAIはタップした時点で保存する
    putSetting(PROVIDER_SETTING, p)
    setKeyStatus(keys[p] ? `${PROVIDER_LABEL[p]} で読み取ります。` : `${PROVIDER_LABEL[p]} のAPIキーを入力してください。`)
  }

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
    setAdvisedDate('')
    setPhase('ready')
  }

  function applyDraft(d: WodDraft) {
    setDraft(d)
    setText(wodToText(d))
    setTitle(d.title || `WOD ${formatDate(date)}`)
    setPhase('edit')
  }

  /**
   * その日の補助トレをどうするか判定する。
   * 予定種目が無い日 (完全休養・週末) は判定するものが無いので呼ばない。
   */
  async function runAdvice(d: WodDraft, forDate: string) {
    if (!advise) return
    const day = planDay(forDate)
    // 補助トレの場所 (Jexer / 家ジム) に合わせた種目リストで判定する
    const location = gymLocationOf(await getSetting(GYM_SETTING))
    const planned = day ? exercisesFor(day.kind, location) : null
    if (!day || !planned?.length) {
      setAdvisedDate(forDate)
      return
    }
    setJudging(true)
    try {
      const a = await judgeAccessory(
        d,
        { date: forDate, pm: day.pm, note: day.note, exercises: planned, topRules: TOP_RULES },
        ai,
        quality,
      )
      setDraft(prev => ({ ...prev, advice: { ...a, forDate } }))
      setAdvisedDate(forDate)
    } catch (err) {
      console.error(err)
      setError('補助トレの判定に失敗しました。読み取り結果はそのまま保存できます。')
    } finally {
      setJudging(false)
    }
  }

  /** 文字は読み取らず、写真をそのままWODとして残す (手書きのボードはこれがいちばん確実) */
  function keepPhoto() {
    setDraft(emptyDraft())
    setText('')
    setTitle(`WOD ${formatDate(date)}`)
    setPhase('edit')
  }

  /** AIで読み取る。キー未設定なら呼ばれない */
  async function runAi() {
    if (!file) return
    setPhase('reading')
    setError('')
    try {
      const d = await transcribeWod(file, ai, quality)
      applyDraft(d)
      // 読み取れた内容をそのまま使って、続けて補助トレを判定する
      await runAdvice(d, date)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : '読み取りに失敗しました。')
      setPhase('ready')
    }
  }

  async function saveKey() {
    const v = keyInput.trim()
    if (!v) return
    setKeyStatus('確認中…')
    try {
      const models = await checkApiKey(provider, v)
      if (models) {
        await putSetting(OPENAI_MODELS_SETTING, JSON.stringify(models))
        setOpenaiModels(models)
      }
      await putSetting(KEY_SETTING[provider], v)
      setKeys(k => ({ ...k, [provider]: v }))
      setKeyInput('')
      setKeyStatus('保存しました。')
      setKeyOpen(false)
    } catch (err) {
      console.error(err)
      setKeyStatus(
        `このキーでは接続できませんでした。${err instanceof Error && err.message.startsWith('OpenAI') ? `(${err.message})` : ''}`,
      )
    }
  }

  async function clearKey() {
    await deleteSetting(KEY_SETTING[provider])
    setKeys(k => ({ ...k, [provider]: '' }))
    setKeyStatus('削除しました。')
  }

  async function handleSave() {
    if (!file) return
    setSaving(true)
    try {
      const imageId = await saveImageFile(file)
      const now = Date.now()
      const content = text.trim() || (photoOnly ? '📷 写真で記録したWOD' : '')
      const body = result.trim() ? `${content}\n\n▶ RESULT: ${result.trim()}` : content
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
          ホワイトボードを撮って保存すると、その日の「今日」タブに写真が表示されます。
          APIキーを設定すると、種目・回数・重量まで文字で読み取れます。
        </p>
      </div>

      {phase === 'pick' && (
        <>
          <button className="scan-drop" onClick={() => fileRef.current?.click()}>
            <CameraIcon size={36} />
            <span>WODの画像を撮影 / 選択</span>
          </button>

          <ApiKeyPanel
            ai={ai}
            onPickProvider={pickProvider}
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
              <button className="btn-primary wide" onClick={runAi}>
                {provider === 'openai' ? 'ChatGPT' : 'Claude'} で読み取る ({tierInfo(ai, quality).label} · {tierInfo(ai, quality).cost})
              </button>
              <button className="btn-ghost wide" onClick={keepPhoto}>
                読み取らずに写真のまま保存
              </button>
            </>
          ) : (
            <>
              <button className="btn-primary wide" onClick={keepPhoto}>
                📷 写真のまま保存する
              </button>
              <p className="scan-hint">
                種目・回数まで文字で読み取りたいときは、APIキーを設定してください。
              </p>
              <button className="btn-ghost wide" onClick={() => setKeyOpen(true)}>
                APIキーを設定して読み取る
              </button>
            </>
          )}
          <button className="btn-ghost wide" onClick={reset}>
            画像を選び直す
          </button>
          {!apiKey && (
            <ApiKeyPanel
              ai={ai}
              onPickProvider={pickProvider}
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

      {phase === 'reading' && (
        <div className="scan-progress">
          <div className="progress-track">
            <div className="progress-fill indeterminate" />
          </div>
          <p>読み取り中…</p>
          <p className="empty-sub">手書きの文字を読み取っています。10〜20秒ほどかかります。</p>
        </div>
      )}

      {phase === 'edit' && (
        <>
          {photoOnly ? (
            <p className="scan-hint">
              📷 写真のまま保存します。種目や回数をメモしておきたいときは、下の「メモ」に書き足してください (空欄でもOK)。
            </p>
          ) : (
            <p className={`scan-hint${draft.confidence === 'high' ? '' : ' warn'}`}>
              {`読み取り: ${CONFIDENCE_LABEL[draft.confidence]}。保存前に確認・修正してください。`}
            </p>
          )}

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

          {judging && <p className="scan-hint">今夜の補助トレをどうするか判定しています…</p>}

          {draft.advice && (
            <>
              <label className="field-label">今夜の補助トレ</label>
              <AdviceCard advice={draft.advice} />
            </>
          )}

          {draft.advice && advisedDate !== date && (
            <div className="scan-actions">
              <p className="fine">
                日付を {formatDate(date)} に変えました。上の判定は {formatDate(advisedDate)} の予定に
                対するものです。
              </p>
              <button
                className="btn-ghost wide"
                onClick={() => runAdvice(draft, date)}
                disabled={judging}
              >
                この日の予定で判定し直す
              </button>
            </div>
          )}

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
            {photoOnly ? 'メモ (任意)' : 'WODの内容 (編集可能)'}
          </label>
          <textarea
            id="wod-text"
            className="input textarea"
            rows={photoOnly ? 4 : 10}
            placeholder={photoOnly ? '例: AMRAP 12分 / Thruster 40kg / Pull-up' : undefined}
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
  ai,
  onPickProvider,
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
  ai: AiConfig
  onPickProvider: (p: Provider) => void
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
  const apiKey = ai.apiKey
  const tier = tierInfo(ai, quality)
  return (
    <div className="key-panel">
      <button className="key-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>読み取りの設定</span>
        <span className="key-state">
          {apiKey ? `${ai.provider === 'openai' ? 'ChatGPT' : 'Claude'} · ${tier.label}` : '未設定'}
        </span>
      </button>

      {open && (
        <div className="key-body">
          <p className="fine">
            Claude (Anthropic) か ChatGPT (OpenAI) の APIキーを設定すると、手書きのボードの写真から
            種目・回数・重量まで読み取ります。キーがなくても、写真のまま保存はできます。
          </p>
          <label className="field-label">使うAI</label>
          <div className="chip-row">
            {(['anthropic', 'openai'] as const).map(p => (
              <button
                key={p}
                className={`chip ${p === ai.provider ? 'chip-on' : ''}`}
                onClick={() => onPickProvider(p)}
              >
                {PROVIDER_LABEL[p]}
              </button>
            ))}
          </div>
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
                {tier.label} — {tier.cost}（{tier.model}）。
                {quality === 'eco' &&
                  'いちばん安い代わりに読み間違いが増えます。同じ写真を標準と見比べて決めてください。'}
                {quality === 'standard' && '普段はこれで十分です。読めないボードだけ高精度に上げてください。'}
                {quality === 'best' && '標準で読めなかったボード用です。'}
              </p>
            </>
          )}

          <label className="field-label" htmlFor="api-key">
            {ai.provider === 'openai' ? 'OpenAI' : 'Anthropic'} APIキー
          </label>
          <input
            id="api-key"
            className="input"
            type="password"
            autoComplete="off"
            placeholder={apiKey ? '変更するときだけ入力' : ai.provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
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
