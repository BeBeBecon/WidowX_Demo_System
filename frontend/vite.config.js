import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ----------------
// Vite設定
// 開発時: /api・/ws・/internal をバックエンド(8765番)にプロキシ
// host: true  → 同一LAN内のスマホから http://<LinuxIP>:5278 でアクセス可能
//
// 【別PCからの接続方法 (例: MacBook から Linux バックエンドに繋ぐ場合)】
// frontend/.env.local を作成して以下を設定する（git管理外）:
//   BACKEND_URL=http://192.168.x.x:8765
//   VITE_WS_URL=ws://192.168.x.x:8765/ws
// ----------------
const backendUrl = process.env.BACKEND_URL || 'http://localhost:8765'
const wsUrl      = backendUrl.replace(/^http/, 'ws')

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // 0.0.0.0 でリッスン → LAN内スマホからアクセス可
    port: 5278,
    proxy: {
      '/api':      { target: backendUrl, changeOrigin: true },
      '/ws':       { target: wsUrl,      ws: true },
      '/internal': { target: backendUrl, changeOrigin: true },
    },
  },
})
