import type { Memo, PR, StoredImage } from './types'

const DB_NAME = 'cf-memo-db'
const DB_VERSION = 1

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
