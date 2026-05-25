// ----------------
// HistoryPanel.jsx
// 実行履歴パネル（最新10件）
// done=緑, error=赤 でカラーコード、折りたたみ対応
// App.jsx から execHistory[] を受け取る
// ----------------
import { useState } from 'react'

export default function HistoryPanel({ history }) {
  const [isOpen, setIsOpen] = useState(true)

  if (!history.length) return null

  // 最新10件を表示（最新が先頭）
  const recent = history.slice(-10).reverse()

  return (
    <div className="glass p-5 space-y-3">
      {/* ヘッダー: 折りたたみトグル */}
      <div
        className="flex items-center gap-2 cursor-pointer select-none"
        onClick={() => setIsOpen(o => !o)}
      >
        <div className="w-px h-4 bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
        <h2 className="panel-label">Execution History</h2>
        <span className="ml-auto text-[10px] text-white/25 tracking-widest font-mono">
          {history.length} RUNS
        </span>
        <span className="text-white/30 text-xs font-mono ml-1">
          {isOpen ? '▲' : '▼'}
        </span>
      </div>

      {isOpen && (
        <div className="space-y-1.5">
          {recent.map((item, idx) => {
            const isDone  = item.result === 'done'
            const isError = item.result === 'error'

            return (
              <div
                key={idx}
                className={`flex items-center gap-3 px-3 py-2.5 border transition-colors duration-200
                  ${isDone  ? 'border-emerald-500/20 bg-emerald-500/4'  : ''}
                  ${isError ? 'border-red-500/20 bg-red-500/4'          : ''}
                `}
              >
                {/* 結果インジケーター */}
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isDone  ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]' :
                  isError ? 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.7)]'      : 'bg-white/20'
                }`} />

                {/* スキル名 */}
                <span className={`text-xs font-mono shrink-0 w-24 truncate ${
                  isDone  ? 'text-emerald-300/70' :
                  isError ? 'text-red-300/70'     : 'text-white/40'
                }`}>
                  {item.skillName ?? '—'}
                </span>

                {/* コマンドテキスト */}
                <span className="flex-1 text-xs text-white/45 font-mono truncate">
                  {item.command}
                </span>

                {/* 経過秒 + タイムスタンプ */}
                <div className="flex items-center gap-2 shrink-0 text-[10px] text-white/25 font-mono">
                  {item.duration != null && (
                    <span>{item.duration}s</span>
                  )}
                  <span>{new Date(item.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
