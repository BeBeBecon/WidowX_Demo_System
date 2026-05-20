// ----------------
// LogPanel.jsx
// バックエンドから受信したログ行をリアルタイム表示する
// ターミナル風スタイル: グリーンオン ブラック
// ----------------
import { useEffect, useRef } from 'react'

// ログ行の種別に応じて色を変える
const lineColor = (line) => {
  if (line.startsWith('[ERROR]'))    return 'text-red-400'
  if (line.startsWith('[DRY RUN]'))  return 'text-amber-300'
  if (line.startsWith('[LLM]'))      return 'text-cyan-300'
  if (line.startsWith('[INFO]'))     return 'text-emerald-300'
  return 'text-emerald-400/80'
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
          <div className="w-px h-4 bg-cyan-400 shadow-[0_0_6px_rgba(0,229,255,0.8)]" />
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
           className="h-80 overflow-y-auto bg-black/70 border border-cyan-500/10 p-4 space-y-1
                      shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
        {logs.length === 0 ? (
          <p className="text-sm text-emerald-400/40 select-none font-mono">
            {'>'} Awaiting command...
            <span className="cursor-blink">_</span>
          </p>
        ) : (
          <>
            {logs.map((line, i) => (
              <p key={i} className={`text-sm leading-relaxed break-all font-mono ${lineColor(line)}`}>
                <span className="text-cyan-400/40 select-none mr-1">{'>'}</span>
                {line}
              </p>
            ))}
            <p className="text-sm text-emerald-400/40 font-mono">
              <span className="cursor-blink">_</span>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
