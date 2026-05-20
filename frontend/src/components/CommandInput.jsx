// ----------------
// CommandInput.jsx
// ユーザーがテキスト命令を入力して送信するフォーム
// 実行ボタンの横に緊急停止ボタンを配置（実行中のみ有効）
// ----------------
import { useState } from 'react'

// デモ用サンプルコマンド
const SAMPLES = [
  'キューブを掴んでください',
  'Pick up the red cube',
  'ホームポジションに戻って',
  'Stack the cubes on top of each other',
]

export default function CommandInput({ onSubmit, onEmergencyStop, disabled, isBusy }) {
  const [text, setText] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!text.trim() || disabled) return
    onSubmit(text.trim())
  }

  return (
    <div className="glass p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest">
        Command Input
      </h2>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSubmit(e) }}
          placeholder="ロボットへの命令を入力（例: キューブを掴んで）"
          rows={4}
          disabled={disabled}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3
                     text-sm text-white/80 placeholder-white/25
                     focus:outline-none focus:border-blue-400/50 focus:bg-white/8
                     transition-all duration-200 disabled:opacity-40"
        />

        {/* 実行ボタン + 緊急停止ボタン（横並び） */}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={disabled || !text.trim()}
            className="flex-1 py-3 rounded-xl font-semibold text-sm tracking-wide
                       bg-blue-500/80 hover:bg-blue-400/90 active:scale-95
                       disabled:opacity-30 disabled:cursor-not-allowed
                       transition-all duration-200 backdrop-blur-sm"
          >
            {isBusy ? '処理中...' : '▶  実行'}
          </button>

          {/* 緊急停止: 実行中のみ有効。誤作動防止のため常時表示するが非実行時は無効 */}
          <button
            type="button"
            onClick={onEmergencyStop}
            disabled={!isBusy}
            className="px-5 py-3 rounded-xl font-semibold text-sm tracking-wide
                       bg-red-600/80 hover:bg-red-500/90 active:scale-95
                       disabled:opacity-25 disabled:cursor-not-allowed
                       text-white border border-red-400/30
                       transition-all duration-200 backdrop-blur-sm"
            title="実行中のロボット動作を即時停止"
          >
            ⏹ 緊急停止
          </button>
        </div>
      </form>

      {/* サンプルコマンド */}
      <div className="space-y-2">
        <p className="text-xs text-white/30">サンプル命令:</p>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map(s => (
            <button
              key={s}
              onClick={() => setText(s)}
              disabled={disabled}
              className="px-3 py-1 text-xs rounded-lg bg-white/5 border border-white/10
                         hover:bg-white/10 text-white/50 hover:text-white/80
                         transition-all duration-150 disabled:opacity-30"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
