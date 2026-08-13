import { useRef, useState } from 'react'
import { deleteImage, putMemo } from '../db'
import { saveImageFile, useImageUrl } from '../images'
import { CATEGORY_META, newId, type Category, type Memo } from '../types'
import { BackIcon, CameraIcon } from './Icons'

/** 新規メモの下書き (プランの「この日のメモを書く」から渡される) */
export interface MemoDraft {
  category?: Category
  title?: string
  body?: string
  tags?: string[]
}

interface Props {
  memo?: Memo
  draft?: MemoDraft
  onSaved: (memo: Memo) => void
  onCancel: () => void
}

function EditThumb({ imageId, onRemove }: { imageId: string; onRemove: () => void }) {
  const url = useImageUrl(imageId)
  return (
    <div className="edit-thumb">
      {url && <img src={url} alt="" />}
      <button type="button" className="edit-thumb-remove" onClick={onRemove} aria-label="画像を削除">
        ×
      </button>
    </div>
  )
}

export default function MemoEditor({ memo, draft, onSaved, onCancel }: Props) {
  const [category, setCategory] = useState<Category>(memo?.category ?? draft?.category ?? 'wod')
  const [title, setTitle] = useState(memo?.title ?? draft?.title ?? '')
  const [body, setBody] = useState(memo?.body ?? draft?.body ?? '')
  const [tagsText, setTagsText] = useState((memo?.tags ?? draft?.tags ?? []).join(', '))
  const [imageIds, setImageIds] = useState<string[]>(memo?.imageIds ?? [])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  // このセッションで新規追加した画像 (キャンセル時に掃除する)
  const addedRef = useRef<string[]>([])

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    try {
      for (const file of Array.from(files)) {
        const id = await saveImageFile(file)
        addedRef.current.push(id)
        setImageIds(prev => [...prev, id])
      }
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function removeImage(id: string) {
    setImageIds(prev => prev.filter(x => x !== id))
    if (addedRef.current.includes(id)) {
      addedRef.current = addedRef.current.filter(x => x !== id)
      await deleteImage(id)
    }
  }

  async function handleCancel() {
    for (const id of addedRef.current) await deleteImage(id)
    onCancel()
  }

  async function handleSave() {
    const now = Date.now()
    const saved: Memo = {
      id: memo?.id ?? newId(),
      category,
      title: title.trim(),
      body: body.trim(),
      tags: tagsText
        .split(/[,、\s]+/)
        .map(t => t.replace(/^#/, '').trim())
        .filter(Boolean),
      imageIds,
      createdAt: memo?.createdAt ?? now,
      updatedAt: now,
    }
    // 既存メモから外された画像を削除
    if (memo) {
      for (const id of memo.imageIds) {
        if (!saved.imageIds.includes(id)) await deleteImage(id)
      }
    }
    await putMemo(saved)
    onSaved(saved)
  }

  return (
    <div className="page">
      <div className="topbar">
        <button className="icon-btn" onClick={handleCancel} aria-label="戻る">
          <BackIcon />
        </button>
        <span className="topbar-title">{memo ? 'メモを編集' : '新規メモ'}</span>
        <button className="btn-primary" onClick={handleSave} disabled={busy}>
          保存
        </button>
      </div>

      <div className="chip-row">
        {(Object.keys(CATEGORY_META) as Category[]).map(c => (
          <button
            key={c}
            className={`chip ${category === c ? 'chip-on' : ''}`}
            style={category === c ? { borderColor: CATEGORY_META[c].color, color: CATEGORY_META[c].color } : undefined}
            onClick={() => setCategory(c)}
          >
            {CATEGORY_META[c].label}
          </button>
        ))}
      </div>

      <input
        className="input"
        placeholder="タイトル (例: 5/12 Fran, 減量メシ)"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />

      <textarea
        className="input textarea"
        placeholder="本文…"
        rows={10}
        value={body}
        onChange={e => setBody(e.target.value)}
      />

      <input
        className="input"
        placeholder="タグ (カンマ区切り 例: fran, thruster)"
        value={tagsText}
        onChange={e => setTagsText(e.target.value)}
      />

      <div className="edit-thumbs">
        {imageIds.map(id => (
          <EditThumb key={id} imageId={id} onRemove={() => removeImage(id)} />
        ))}
        <button
          type="button"
          className="edit-thumb add"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          aria-label="画像を追加"
        >
          <CameraIcon size={24} />
          <span>{busy ? '処理中…' : '画像追加'}</span>
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  )
}
