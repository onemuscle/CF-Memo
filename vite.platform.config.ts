import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// CF MEMO プラットフォーム (Cloudflare Workers で配信する Web アプリ)
// 開発時は `npm run dev:api` (wrangler dev) を別に起動し、/api をそちらへ転送する
export default defineConfig({
  root: fileURLToPath(new URL('./platform', import.meta.url)),
  base: '/',
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('./dist-platform', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: { '/api': 'http://localhost:8787' },
  },
})
