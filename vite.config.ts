import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      // CF MEMO (/)・みんな向け版 Fitto (/app/)・ワークアウト生成サイト きょうトレ (/workout/) の3ページ構成
      input: {
        main: page('./index.html'),
        app: page('./app/index.html'),
        workout: page('./workout/index.html'),
      },
    },
  },
})
