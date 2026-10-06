import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      // CF MEMO (/) と ワークアウト生成サイト きょうトレ (/workout/) の2ページ構成
      input: {
        main: page('./index.html'),
        workout: page('./workout/index.html'),
      },
    },
  },
})
