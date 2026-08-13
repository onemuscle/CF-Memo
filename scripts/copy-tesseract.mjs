// tesseract.js のワーカー/コアを node_modules から public/ にコピーする。
// CDN依存をなくし、オフライン(電波の悪いジム)でもOCRが動くようにするため。
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dest = join(root, 'public', 'tesseract')
mkdirSync(dest, { recursive: true })

const files = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
]

for (const [src, name] of files) {
  copyFileSync(join(root, 'node_modules', src), join(dest, name))
}
console.log(`copied ${files.length} tesseract assets to public/tesseract/`)
