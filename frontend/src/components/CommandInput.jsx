// ----------------
// CommandInput.jsx
// ユーザーがテキスト命令を入力して送信するフォーム
// 実行ボタンの横に緊急停止ボタンを配置（実行中のみ有効）
// ↑↓キーでコマンド履歴ナビゲーション対応
// prefill props でスキルカードからのワンクリック入力に対応
// ----------------
import { useState, useEffect } from 'react'

// デモ用サンプルコマンド（実装済み・計画中を明示）
const SAMPLES = [
  { label: 'キューブを掴んでください',          active: true  },
  { label: '手を振って',                        active: false },
  { label: 'お茶のペットボトルを運んで',        active: false },
  { label: 'ホームポジションに戻って',          active: true  },
]

export default function CommandInput({ onSubmit, onEmergencyStop, disabled, isBusy, prefill }) {
  const [text, setText]               = useState('')
  // ----------------
  // コマンド履歴管理
  // historyIndex: -1 = 現在入力中, 0 = 最新, length-1 = 最古
  // ----------------
  const [history, setHistory]         = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  // ----------------
  // prefill 変化を検知してテキストにセット（スキルカードクリック時）
  // seq が変わるたびに発火するので同一テキスト連打にも対応
  // ----------------
  useEffect(() => {
    if (prefill?.text) {
      setText(prefill.text)
      setHistoryIndex(-1)
    }
  }, [prefill])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!text.trim() || disabled) return
    const cmd = text.trim()
    // 直前と重複しない場合のみ履歴に追加
    setHistory(prev => (prev[0] === cmd ? prev : [cmd, ...prev].slice(0, 50)))
    setHistoryIndex(-1)
    onSubmit(cmd)
  }

  // ----------------
  // ↑↓キーで履歴ナビゲーション（ターミナル風）
  // ----------------
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHistory(prev => {
        const next = Math.min(historyIndex + 1, prev.length - 1)
        setHistoryIndex(next)
        if (prev[next] !== undefined) setText(prev[next])
        return prev
      })
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex <= 0) {
        setHistoryIndex(-1)
        setText('')
      } else {
        setHistory(prev => {
          const next = historyIndex - 1
          setHistoryIndex(next)
          if (prev[next] !== undefined) setText(prev[next])
          return prev
        })
      }
    }
  }

  // Quick Commands クリック: テキストセット + 履歴追加
  const handleQuickClick = (label) => {
    setText(label)
    setHistoryIndex(-1)
  }

  return (
    <div className="glass p-6 space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-px h-4 bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
        <h2 className="panel-label">Command Input</h2>
        {/* 履歴件数インジケーター */}
        {history.length > 0 && (
          <span className="ml-auto text-[10px] text-white/25 tracking-widest font-mono">
            HIST {history.length}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* 命令入力エリア */}
        <div className="relative">
          {/* 入力フィールドの左アクセントライン */}
          <div className={`absolute left-0 top-0 bottom-0 w-px transition-colors duration-300 ${
            disabled ? 'bg-white/10' : 'bg-amber-500/50'
          }`} />
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ロボットへの命令を入力（例: キューブを掴んで）"
            rows={5}
            disabled={disabled}
            className="w-full bg-black/30 border border-white/8 rounded-none pl-4 pr-4 py-3
                       text-base text-white/85 placeholder-white/25
                       focus:outline-none focus:border-amber-400/40
                       focus:shadow-[0_0_15px_rgba(245,158,11,0.06)]
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
            className="btn-neon flex-1 py-3.5 rounded-none font-bold text-base tracking-[0.15em] uppercase font-mono
                       border border-amber-400/40 text-amber-300
                       hover:border-amber-400/70 hover:text-amber-100
                       hover:shadow-[0_0_15px_rgba(245,158,11,0.18)]
                       disabled:opacity-25 disabled:cursor-not-allowed
                       transition-all duration-200"
          >
            {isBusy ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                Processing...
              </span>
            ) : '▶  Execute'}
          </button>

          {/* 緊急停止ボタン: 実行中のみ有効 */}
          <button
            type="button"
            onClick={onEmergencyStop}
            disabled={!isBusy}
            className="btn-neon px-5 py-3.5 rounded-none font-bold text-base tracking-[0.12em] uppercase font-mono
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
        <p className="text-[10px] text-white/30 tracking-widest uppercase font-mono">Quick Commands</p>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map(s => (
            <button
              key={s.label}
              onClick={() => handleQuickClick(s.label)}
              disabled={disabled}
              className={`px-3 py-1 text-xs rounded-none border transition-all duration-150
                         disabled:opacity-20 font-mono
                         ${s.active
                           ? 'border-amber-500/25 text-amber-400/65 hover:border-amber-400/55 hover:text-amber-300 bg-amber-500/5'
                           : 'border-white/8 text-white/30 hover:border-white/18 hover:text-white/50 bg-white/2'
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
