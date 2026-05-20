import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ----------------
// Vite設定
// 開発時: /api と /ws をバックエンド(8765番)にプロキシ
// 本番時: VITE_API_URL 環境変数でバックエンドURLを指定
// ----------------
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5278,
    proxy: {
      '/api': { target: 'http://localhost:8765', changeOrigin: true },
      '/ws':  { target: 'ws://localhost:8765',  ws: true },
    },
  },
})
