import { useMemo, useState } from 'react'
import { CATEGORY_META, formatDate, type Category, type Memo } from '../types'
import { useImageUrl } from '../images'
import { PlusIcon, SearchIcon } from './Icons'

interface Props {
  memos: Memo[]
  onOpen: (id: string) => void
  onNew: () => void
}

function Thumb({ imageId }: { imageId: string }) {
  const url = useImageUrl(imageId)
  return url ? <img className="card-thumb" src={url} alt="" /> : <div className="card-thumb" />
}

export default function MemoList({ memos, onOpen, onNew }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category | 'all'>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return memos.filter(m => {
      if (category !== 'all' && m.category !== category) return false
      if (!q) return true
      const haystack = `${m.title}\n${m.body}\n${m.tags.join(' ')}`.toLowerCase()
      return q.split(/\s+/).every(term => haystack.includes(term))
    })
  }, [memos, query, category])

  return (
    <div className="page">
      <div className="search-box">
        <SearchIcon size={18} />
        <input
          type="search"
          placeholder="メモを検索 (タイトル・本文・タグ)"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="chip-row">
        <button
          className={`chip ${category === 'all' ? 'chip-on' : ''}`}
          onClick={() => setCategory('all')}
        >
          すべて
        </button>
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

      {filtered.length === 0 ? (
        <div className="empty">
          <p>{memos.length === 0 ? 'まだメモがありません。' : '該当するメモが見つかりません。'}</p>
          {memos.length === 0 && <p className="empty-sub">右下の + から最初のメモを書きましょう。</p>}
        </div>
      ) : (
        <ul className="memo-list">
          {filtered.map(m => {
            const meta = CATEGORY_META[m.category]
            return (
              <li key={m.id}>
                <button className="memo-card" onClick={() => onOpen(m.id)}>
                  <div className="memo-card-body">
                    <div className="memo-card-top">
                      <span className="cat-badge" style={{ color: meta.color, borderColor: meta.color }}>
                        {meta.label}
                      </span>
                      <span className="memo-date">{formatDate(new Date(m.updatedAt).toISOString().slice(0, 10))}</span>
                    </div>
                    <h3 className="memo-title">{m.title || '(無題)'}</h3>
                    {m.body && <p className="memo-preview">{m.body}</p>}
                    {m.tags.length > 0 && (
                      <div className="tag-row">
                        {m.tags.map(t => (
                          <span key={t} className="tag">#{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {m.imageIds[0] && <Thumb imageId={m.imageIds[0]} />}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <button className="fab" onClick={onNew} aria-label="新規メモ">
        <PlusIcon size={26} />
      </button>
    </div>
  )
}
