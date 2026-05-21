// ----------------
// LogPanel.jsx
// バックエンドから受信したログ行をリアルタイム表示する
// ターミナル風スタイル: モノスペースフォント固定
// ----------------
import { useEffect, useRef } from 'react'

// ログ行の種別に応じて色を変える
const lineColor = (line) => {
  if (line.startsWith('[ERROR]'))    return 'text-red-400'
  if (line.startsWith('[DRY RUN]'))  return 'text-amber-300'
  if (line.startsWith('[LLM]'))      return 'text-amber-400'
  if (line.startsWith('[INFO]'))     return 'text-emerald-300'
  return 'text-white/65'
}

export default function LogPanel({ logs }) {
  const containerRef = useRef(null)

  // 新しいログが来たらコンテナ内を末尾スクロール（ページ全体は動かさない）
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div className="glass p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-px h-4 bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
          <h2 className="panel-label">Execution Log</h2>
        </div>
        {/* ターミナル感を出す装飾 */}
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500/50" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
          <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
        </div>
      </div>

      {/* ターミナル本体 */}
      <div ref={containerRef}
           className="h-80 overflow-y-auto bg-black/50 border border-white/6 p-4 space-y-1
                      shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
        {logs.length === 0 ? (
          <p className="text-sm text-white/30 select-none font-mono">
            {'>'} Awaiting command...
            <span className="cursor-blink">_</span>
          </p>
        ) : (
          <>
            {logs.map((line, i) => (
              <p key={i} className={`text-sm leading-relaxed break-all font-mono ${lineColor(line)}`}>
                <span className="text-amber-400/30 select-none mr-1">{'>'}</span>
                {line}
              </p>
            ))}
            <p className="text-sm text-white/30 font-mono">
              <span className="cursor-blink">_</span>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
