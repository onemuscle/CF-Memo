import { useEffect, useState } from 'react'
import { getImage, putImage } from './db'
import { newId, type StoredImage } from './types'

const MAX_EDGE = 1600

/** 画像を長辺1600pxに縮小してJPEG化し、IndexedDBに保存してidを返す */
export async function saveImageFile(file: File): Promise<string> {
  let blob: Blob = file
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height))
    if (scale < 1 || file.size > 1_500_000) {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bmp.width * scale))
      canvas.height = Math.max(1, Math.round(bmp.height * scale))
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
      blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.85),
      )
    }
    bmp.close()
  } catch {
    // HEICなどcreateImageBitmap非対応の形式は元ファイルのまま保存
  }
  const image: StoredImage = { id: newId(), blob, createdAt: Date.now() }
  await putImage(image)
  return image.id
}

/** IndexedDB上の画像のobject URLを返すフック (アンマウント時に解放) */
export function useImageUrl(id: string | undefined): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!id) {
      setUrl(undefined)
      return
    }
    let objectUrl: string | undefined
    let cancelled = false
    getImage(id).then(image => {
      if (image && !cancelled) {
        objectUrl = URL.createObjectURL(image.blob)
        setUrl(objectUrl)
      }
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id])
  return url
}
