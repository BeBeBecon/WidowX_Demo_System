// =====================================
// PaymentDemo.jsx - スマホ非接触決済デモ画面
// NFCタグ読み取り → このURLへ遷移するシナリオを想定
// バックエンド・ロボット動作とは独立して単体で動作可能
// テーマ: プレミアム決済UI（白ベース）
// =====================================
import { useEffect, useRef, useState } from 'react'

// ----------------
// 設定デフォルト値（config.json から fetch して上書き）
// ----------------
const DEFAULTS = {
  merchant_name: 'WidowX Demo Store',
  amount: '¥1,280',
  currency: 'JPY',
  processing_duration_ms: 2200,
  success_message: '決済が完了しました',
  thank_you_message: 'ありがとうございました',
  brand_color: '#2563eb',
}

// ----------------
// Web Audio API で決済完了音を生成（外部ファイル不要）
// ----------------
function playSuccessSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [523.25, 659.25, 783.99] // C5 → E5 → G5（明るい和音）
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type      = 'sine'
      osc.frequency.value = freq
      const start = ctx.currentTime + i * 0.12
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.18, start + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45)
      osc.start(start)
      osc.stop(start + 0.5)
    })
  } catch (_) {
    // 音声APIが使えない環境では無視
  }
}

// ----------------
// SVGアイコン（外部ライブラリ不使用）
// ----------------
const CheckIcon = () => (
  <svg viewBox="0 0 52 52" fill="none" className="w-full h-full">
    <circle cx="26" cy="26" r="25" stroke="currentColor" strokeWidth="2" />
    <path
      d="M14 26l9 9 15-15"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="check-path"
    />
  </svg>
)

const NfcIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
       strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
    <path d="M8.5 8.5A5.5 5.5 0 0 1 12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-3.5-1.5" />
    <path d="M5 5a9 9 0 0 1 7-3 9 9 0 0 1 9 9 9 9 0 0 1-9 9A9 9 0 0 1 5 19" />
    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
  </svg>
)

// ----------------
// メインコンポーネント
// ----------------
export default function PaymentDemo() {
  const [phase, setPhase]     = useState('processing') // processing | success
  const [config, setConfig]   = useState(DEFAULTS)
  const [showCheck, setCheck] = useState(false)
  const soundPlayed           = useRef(false)

  // config.json から決済デモ設定を取得（失敗時はデフォルト値を使用）
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(d => {
        if (d.payment_demo) {
          setConfig(prev => ({ ...prev, ...d.payment_demo }))
        }
      })
      .catch(() => {})
  }, [])

  // 処理中 → 完了 のフェーズ遷移
  useEffect(() => {
    const duration = config.processing_duration_ms ?? DEFAULTS.processing_duration_ms
    const timer = setTimeout(() => {
      setPhase('success')
      // チェックアイコン表示を少し遅らせてアニメ効果を出す
      setTimeout(() => {
        setCheck(true)
        if (!soundPlayed.current) {
          soundPlayed.current = true
          playSuccessSound()
        }
      }, 80)
    }, duration)
    return () => clearTimeout(timer)
  }, [config.processing_duration_ms])

  const brandColor = config.brand_color ?? DEFAULTS.brand_color
  const isSuccess  = phase === 'success'

  return (
    <div className="payment-root">
      <style>{`
        /* ----------------
           決済デモ専用スタイル（全画面・白ベース）
           ---------------- */
        .payment-root {
          min-height: 100svh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(160deg, #f8fafc 0%, #e2e8f0 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          padding: 24px;
          position: relative;
          overflow: hidden;
        }

        /* 背景装飾ブロブ */
        .payment-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          opacity: 0.35;
        }

        /* ----------------
           カード本体
           ---------------- */
        .payment-card {
          background: #fff;
          border-radius: 24px;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.07),
                      0 20px 50px -10px rgb(0 0 0 / 0.15);
          width: 100%;
          max-width: 380px;
          padding: 40px 32px 36px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          position: relative;
          z-index: 1;
        }

        /* ----------------
           ロゴ・ブランドバー
           ---------------- */
        .payment-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 32px;
          width: 100%;
        }
        .payment-brand-dot {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .payment-brand-name {
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: #0f172a;
        }
        .payment-brand-sub {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 1px;
        }

        /* ----------------
           アイコンエリア
           ---------------- */
        .payment-icon-wrap {
          width: 80px;
          height: 80px;
          margin-bottom: 24px;
          transition: all 0.4s ease;
        }

        /* 処理中: NFC波形アニメ */
        .nfc-rings {
          width: 80px;
          height: 80px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .nfc-ring {
          position: absolute;
          border-radius: 50%;
          border: 2px solid;
          animation: nfc-pulse 1.8s ease-out infinite;
        }
        .nfc-ring:nth-child(1) { width: 40px;  height: 40px;  animation-delay: 0s; }
        .nfc-ring:nth-child(2) { width: 62px;  height: 62px;  animation-delay: 0.3s; }
        .nfc-ring:nth-child(3) { width: 80px;  height: 80px;  animation-delay: 0.6s; }
        @keyframes nfc-pulse {
          0%   { opacity: 0.8; transform: scale(0.85); }
          70%  { opacity: 0.2; }
          100% { opacity: 0;   transform: scale(1.05); }
        }

        /* 完了: チェックアイコン */
        .check-wrap {
          width: 80px;
          height: 80px;
          animation: check-appear 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes check-appear {
          from { transform: scale(0.5); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        .check-path {
          stroke-dasharray: 40;
          stroke-dashoffset: 40;
          animation: draw-check 0.5s ease-out 0.15s forwards;
        }
        @keyframes draw-check {
          to { stroke-dashoffset: 0; }
        }

        /* ----------------
           金額表示
           ---------------- */
        .payment-amount {
          font-size: 42px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #0f172a;
          margin-bottom: 6px;
          transition: all 0.3s;
        }

        /* ----------------
           ステータステキスト
           ---------------- */
        .payment-status {
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 4px;
          transition: color 0.4s;
        }
        .payment-sub {
          font-size: 13px;
          color: #94a3b8;
          margin-bottom: 32px;
          min-height: 20px;
          text-align: center;
        }

        /* ----------------
           ドット区切り（カード下部の詳細情報）
           ---------------- */
        .payment-divider {
          width: 100%;
          height: 1px;
          background: #f1f5f9;
          margin-bottom: 20px;
        }
        .payment-detail-row {
          display: flex;
          justify-content: space-between;
          width: 100%;
          font-size: 13px;
          color: #64748b;
          margin-bottom: 10px;
        }
        .payment-detail-row span:last-child {
          font-weight: 600;
          color: #334155;
        }

        /* 完了バッジ */
        .payment-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          border-radius: 100px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.01em;
          margin-top: 8px;
          animation: badge-in 0.4s ease 0.6s both;
        }
        @keyframes badge-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* フッター */
        .payment-footer {
          margin-top: 24px;
          font-size: 12px;
          color: #cbd5e1;
          text-align: center;
          position: relative;
          z-index: 1;
        }
      `}</style>

      {/* 背景装飾 */}
      <div className="payment-blob"
           style={{ width: 320, height: 320, top: -80, right: -80,
                    background: `${brandColor}20` }} />
      <div className="payment-blob"
           style={{ width: 260, height: 260, bottom: -60, left: -60,
                    background: isSuccess ? '#10b98120' : `${brandColor}15` }} />

      {/* カード */}
      <div className="payment-card">

        {/* ブランドバー */}
        <div className="payment-brand">
          <div className="payment-brand-dot" style={{ background: `${brandColor}15` }}>
            <svg viewBox="0 0 20 20" fill={brandColor} style={{ width: 18, height: 18 }}>
              <path d="M4 4h12a2 2 0 0 1 2 2v1H2V6a2 2 0 0 1 2-2z" />
              <rect x="2" y="9" width="16" height="7" rx="1" />
            </svg>
          </div>
          <div>
            <div className="payment-brand-name">{config.merchant_name}</div>
            <div className="payment-brand-sub">Secure Checkout</div>
          </div>
          {/* SSL バッジ */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center',
                        gap: 4, fontSize: 11, color: '#94a3b8' }}>
            <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 12, height: 12 }}>
              <path d="M8 1a4 4 0 0 0-4 4v1H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1V5a4 4 0 0 0-4-4zm0 1.5a2.5 2.5 0 0 1 2.5 2.5v1h-5V5A2.5 2.5 0 0 1 8 2.5z" />
            </svg>
            SSL
          </div>
        </div>

        {/* アイコン */}
        <div className="payment-icon-wrap">
          {isSuccess && showCheck ? (
            <div className="check-wrap" style={{ color: '#10b981' }}>
              <CheckIcon />
            </div>
          ) : (
            <div className="nfc-rings">
              <div className="nfc-ring" style={{ borderColor: brandColor }} />
              <div className="nfc-ring" style={{ borderColor: brandColor }} />
              <div className="nfc-ring" style={{ borderColor: brandColor }} />
              <div style={{ color: brandColor }}>
                <NfcIcon />
              </div>
            </div>
          )}
        </div>

        {/* 金額 */}
        <div className="payment-amount" style={{ color: isSuccess ? '#10b981' : '#0f172a' }}>
          {config.amount}
        </div>

        {/* ステータスメッセージ */}
        <div className="payment-status"
             style={{ color: isSuccess ? '#10b981' : brandColor }}>
          {isSuccess ? config.success_message : '決済処理中...'}
        </div>
        <div className="payment-sub">
          {isSuccess ? config.thank_you_message : 'しばらくお待ちください'}
        </div>

        {/* 区切り線 + 詳細 */}
        <div className="payment-divider" />
        <div className="payment-detail-row">
          <span>決済方法</span>
          <span>非接触 (NFC)</span>
        </div>
        <div className="payment-detail-row">
          <span>通貨</span>
          <span>{config.currency ?? 'JPY'}</span>
        </div>
        <div className="payment-detail-row">
          <span>ステータス</span>
          <span style={{ color: isSuccess ? '#10b981' : brandColor }}>
            {isSuccess ? '承認済み' : '処理中'}
          </span>
        </div>

        {/* 完了バッジ */}
        {isSuccess && (
          <div className="payment-badge"
               style={{ background: '#10b98115', color: '#10b981' }}>
            <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 14, height: 14 }}>
              <path fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143z"
                clipRule="evenodd" />
            </svg>
            承認番号: {Math.random().toString(36).slice(2, 8).toUpperCase()}
          </div>
        )}
      </div>

      {/* フッター */}
      <div className="payment-footer">
        Powered by WidowX Demo System &nbsp;·&nbsp; Secure &amp; Encrypted
      </div>
    </div>
  )
}
