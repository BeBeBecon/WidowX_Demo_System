// =====================================
// main.jsx - エントリーポイント
// パスベースのシンプルなルーティング（react-router不使用）
// /payment-demo → PaymentDemo / それ以外 → App（メイン操作UI）
// =====================================
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import PaymentDemo from './pages/PaymentDemo'
import './index.css'

// ----------------
// パスで描画コンポーネントを切り替え
// ----------------
const path = window.location.pathname
const Root = path === '/payment-demo' ? PaymentDemo : App

ReactDOM.createRoot(document.getElementById('root')).render(<Root />)
