import { deleteMemo } from '../db'
import { CATEGORY_META, formatDate, type Memo } from '../types'
import { useImageUrl } from '../images'
import { BackIcon, EditIcon, TrashIcon } from './Icons'

interface Props {
  memo: Memo
  onBack: () => void
  onEdit: () => void
  onDeleted: () => void
}

function FullImage({ imageId }: { imageId: string }) {
  const url = useImageUrl(imageId)
  return url ? <img className="detail-image" src={url} alt="添付画像" loading="lazy" /> : null
}

export default function MemoDetail({ memo, onBack, onEdit, onDeleted }: Props) {
  const meta = CATEGORY_META[memo.category]

  async function handleDelete() {
    if (!confirm('このメモを削除しますか？添付画像も削除されます。')) return
    await deleteMemo(memo)
    onDeleted()
  }

  return (
    <div className="page">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="戻る">
          <BackIcon />
        </button>
        <div className="topbar-actions">
          <button className="icon-btn" onClick={onEdit} aria-label="編集">
            <EditIcon size={19} />
          </button>
          <button className="icon-btn danger" onClick={handleDelete} aria-label="削除">
            <TrashIcon size={19} />
          </button>
        </div>
      </div>

      <div className="detail-head">
        <span className="cat-badge" style={{ color: meta.color, borderColor: meta.color }}>
          {meta.label}
        </span>
        <h2 className="detail-title">{memo.title || '(無題)'}</h2>
        <div className="detail-date">
          {formatDate(new Date(memo.createdAt).toISOString().slice(0, 10))}
        </div>
        {memo.tags.length > 0 && (
          <div className="tag-row">
            {memo.tags.map(t => (
              <span key={t} className="tag">#{t}</span>
            ))}
          </div>
        )}
      </div>

      {memo.body && <div className="detail-body">{memo.body}</div>}

      {memo.imageIds.map(id => (
        <FullImage key={id} imageId={id} />
      ))}
    </div>
  )
}
