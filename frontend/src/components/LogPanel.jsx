// ----------------
// LogPanel.jsx
// バックエンドから受信したログ行をリアルタイム表示する
// 新しい行が来たら自動スクロール
// ----------------
import { useEffect, useRef } from 'react'

// ログ行の種別に応じて色を変える
const lineColor = (line) => {
  if (line.startsWith('[ERROR]'))    return 'text-red-400'
  if (line.startsWith('[DRY RUN]'))  return 'text-yellow-400'
  if (line.startsWith('[LLM]'))      return 'text-cyan-400'
  if (line.startsWith('[INFO]'))     return 'text-emerald-400'
  return 'text-white/60'
}

export default function LogPanel({ logs }) {
  const bottomRef = useRef(null)

  // 新しいログが来たら末尾にスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="glass p-5 space-y-3">
      <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest">
        Execution Log
      </h2>

      <div className="h-48 overflow-y-auto rounded-xl bg-black/30 border border-white/5 p-3 space-y-0.5">
        {logs.length === 0 ? (
          <p className="text-xs text-white/20 select-none">ログがここに表示されます...</p>
        ) : (
          logs.map((line, i) => (
            <p key={i} className={`text-xs leading-relaxed break-all ${lineColor(line)}`}>
              {line}
            </p>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
