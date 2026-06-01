import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ----------------
// Vite設定
// 開発時: /api・/ws・/internal をバックエンド(8765番)にプロキシ
// host: true  → 同一LAN内のスマホから http://<LinuxIP>:5278 でアクセス可能
// 本番時: VITE_API_URL 環境変数でバックエンドURLを指定
// ----------------
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // 0.0.0.0 でリッスン → LAN内スマホからアクセス可
    port: 5278,
    proxy: {
      '/api':      { target: 'http://localhost:8765', changeOrigin: true },
      '/ws':       { target: 'ws://localhost:8765',  ws: true },
      '/internal': { target: 'http://localhost:8765', changeOrigin: true },
    },
  },
})
