import type { Memo, PR, ScannedWod, StoredImage } from './types'

const DB_NAME = 'cf-memo-db'
// v2: WODスキャン結果 (wods) と設定 (settings) を追加
const DB_VERSION = 2

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('memos')) {
          db.createObjectStore('memos', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('images')) {
          db.createObjectStore('images', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('prs')) {
          db.createObjectStore('prs', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('wods')) {
          db.createObjectStore('wods', { keyPath: 'date' })
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function getStore(name: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDB()
  return db.transaction(name, mode).objectStore(name)
}

// ---- Memos ----

export async function listMemos(): Promise<Memo[]> {
  const all = await promisify((await getStore('memos', 'readonly')).getAll())
  return (all as Memo[]).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function putMemo(memo: Memo): Promise<void> {
  await promisify((await getStore('memos', 'readwrite')).put(memo))
}

export async function deleteMemo(memo: Memo): Promise<void> {
  await promisify((await getStore('memos', 'readwrite')).delete(memo.id))
  for (const imageId of memo.imageIds) {
    await deleteImage(imageId)
  }
}

// ---- Images ----

export async function putImage(image: StoredImage): Promise<void> {
  await promisify((await getStore('images', 'readwrite')).put(image))
}

export async function getImage(id: string): Promise<StoredImage | undefined> {
  return promisify((await getStore('images', 'readonly')).get(id))
}

export async function deleteImage(id: string): Promise<void> {
  await promisify((await getStore('images', 'readwrite')).delete(id))
}

// ---- PRs ----

export async function listPRs(): Promise<PR[]> {
  const all = await promisify((await getStore('prs', 'readonly')).getAll())
  return (all as PR[]).sort((a, b) =>
    a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date),
  )
}

export async function putPR(pr: PR): Promise<void> {
  await promisify((await getStore('prs', 'readwrite')).put(pr))
}

export async function deletePR(id: string): Promise<void> {
  await promisify((await getStore('prs', 'readwrite')).delete(id))
}

// ---- WODスキャン結果 ----
// 日付をキーにした上書き保存。同じ日を2回撮り直したら新しい方が残る。

export async function listWods(): Promise<ScannedWod[]> {
  const all = await promisify((await getStore('wods', 'readonly')).getAll())
  return (all as ScannedWod[]).sort((a, b) => b.date.localeCompare(a.date))
}

export async function getWod(date: string): Promise<ScannedWod | undefined> {
  return promisify((await getStore('wods', 'readonly')).get(date))
}

export async function putWod(wod: ScannedWod): Promise<void> {
  await promisify((await getStore('wods', 'readwrite')).put(wod))
}

export async function deleteWod(date: string): Promise<void> {
  await promisify((await getStore('wods', 'readwrite')).delete(date))
}

// ---- 設定 ----
// APIキーはここ (端末内のIndexedDB) にだけ置く。リポジトリにもサーバーにも保存しない。

export async function getSetting(key: string): Promise<string | undefined> {
  const row = await promisify(
    (await getStore('settings', 'readonly')).get(key),
  )
  return (row as { key: string; value: string } | undefined)?.value
}

export async function putSetting(key: string, value: string): Promise<void> {
  await promisify((await getStore('settings', 'readwrite')).put({ key, value }))
}

export async function deleteSetting(key: string): Promise<void> {
  await promisify((await getStore('settings', 'readwrite')).delete(key))
}
