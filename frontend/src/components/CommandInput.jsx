// ----------------
// CommandInput.jsx
// ユーザーがテキスト命令を入力して送信するフォーム
// 実行ボタンの横に緊急停止ボタンを配置（実行中のみ有効）
// ----------------
import { useState } from 'react'

// デモ用サンプルコマンド（実装済み・計画中を明示）
const SAMPLES = [
  { label: 'キューブを掴んでください',          active: true  },
  { label: '手を振って',                        active: false },
  { label: 'お茶のペットボトルを運んで',        active: false },
  { label: 'ホームポジションに戻って',          active: true  },
  { label: 'Stack the cubes on top of each other', active: true },
]

export default function CommandInput({ onSubmit, onEmergencyStop, disabled, isBusy }) {
  const [text, setText] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!text.trim() || disabled) return
    onSubmit(text.trim())
  }

  return (
    <div className="glass p-6 space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-px h-4 bg-cyan-400 shadow-[0_0_6px_rgba(0,229,255,0.8)]" />
        <h2 className="panel-label">Command Input</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* 命令入力エリア */}
        <div className="relative">
          {/* 入力フィールドの左アクセントライン */}
          <div className={`absolute left-0 top-0 bottom-0 w-px transition-colors duration-300 ${
            disabled ? 'bg-cyan-500/10' : 'bg-cyan-500/50'
          }`} />
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="ロボットへの命令を入力（例: キューブを掴んで）"
            rows={5}
            disabled={disabled}
            className="w-full bg-black/40 border border-cyan-500/15 rounded-none pl-4 pr-4 py-3
                       text-base text-cyan-100 placeholder-cyan-400/30
                       focus:outline-none focus:border-cyan-400/50
                       focus:shadow-[0_0_15px_rgba(0,229,255,0.08)]
                       transition-all duration-200 disabled:opacity-30
                       font-mono tracking-wide"
          />
        </div>

        {/* ボタン行: 実行 + 緊急停止 */}
        <div className="flex gap-2">
          {/* 実行ボタン */}
          <button
            type="submit"
            disabled={disabled || !text.trim()}
            className="btn-neon flex-1 py-3.5 rounded-none font-bold text-base tracking-[0.15em] uppercase
                       border border-cyan-400/40 text-cyan-300
                       hover:border-cyan-400/80 hover:text-cyan-100
                       hover:shadow-[0_0_15px_rgba(0,229,255,0.2)]
                       disabled:opacity-25 disabled:cursor-not-allowed
                       transition-all duration-200"
          >
            {isBusy ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                Processing...
              </span>
            ) : '▶  Execute'}
          </button>

          {/* 緊急停止ボタン: 実行中のみ有効 */}
          <button
            type="button"
            onClick={onEmergencyStop}
            disabled={!isBusy}
            className="btn-neon px-5 py-3.5 rounded-none font-bold text-base tracking-[0.12em] uppercase
                       border border-red-500/50 text-red-400
                       hover:border-red-400/90 hover:text-red-300
                       hover:shadow-[0_0_15px_rgba(255,50,50,0.25)]
                       disabled:opacity-20 disabled:cursor-not-allowed
                       transition-all duration-200"
            title="実行中のロボット動作を即時停止"
          >
            ⏹ E-Stop
          </button>
        </div>
      </form>

      {/* サンプルコマンド */}
      <div className="space-y-2">
        <p className="text-[10px] text-cyan-400/50 tracking-widest uppercase">Quick Commands</p>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map(s => (
            <button
              key={s.label}
              onClick={() => setText(s.label)}
              disabled={disabled}
              className={`px-3 py-1 text-xs rounded-none border transition-all duration-150
                         disabled:opacity-20 font-mono
                         ${s.active
                           ? 'border-cyan-500/30 text-cyan-400/70 hover:border-cyan-400/60 hover:text-cyan-300 bg-cyan-500/5'
                           : 'border-white/10 text-white/30 hover:border-white/20 hover:text-white/50 bg-white/2'
                         }`}
            >
              {s.label}
              {!s.active && <span className="ml-1 text-[9px] text-white/20">(予定)</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
