// ----------------
// LogPanel.jsx
// バックエンドから受信したログ行をリアルタイム表示する
// ターミナル風スタイル: モノスペースフォント固定
// ヘッダーにコピー・ダウンロードボタンを追加
// ----------------
import { useEffect, useRef, useState } from 'react'

// ログ行の種別に応じて色を変える
const lineColor = (line) => {
  if (line.startsWith('[ERROR]'))    return 'text-red-400'
  if (line.startsWith('[DRY RUN]'))  return 'text-amber-300'
  if (line.startsWith('[LLM]'))      return 'text-amber-400'
  if (line.startsWith('[INFO]'))     return 'text-emerald-300'
  return 'text-white/65'
}

// flexible=true のとき、外側が flex flex-col であることを前提に h-full で余白を埋める
export default function LogPanel({ logs, flexible = false }) {
  const containerRef = useRef(null)
  const [copied, setCopied] = useState(false)

  // 新しいログが来たらコンテナ内を末尾スクロール（ページ全体は動かさない）
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs])

  // ----------------
  // ログをクリップボードにコピー
  // ----------------
  const handleCopy = () => {
    navigator.clipboard.writeText(logs.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  // ----------------
  // ログをタイムスタンプ付き .txt としてダウンロード
  // ----------------
  const handleDownload = () => {
    const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `widowx-log-${ts}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={`glass p-5 space-y-4 ${flexible ? 'flex flex-col h-full' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-px h-4 bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
          <h2 className="panel-label">Execution Log</h2>
        </div>

        {/* ターミナル感を出す装飾 + ログ操作ボタン */}
        <div className="flex items-center gap-3">
          {/* コピー・ダウンロード（ログが空のときは非表示） */}
          {logs.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopy}
                title="ログをコピー"
                className="text-[10px] px-2 py-0.5 border border-white/10 text-white/30 font-mono
                           hover:border-amber-400/40 hover:text-amber-400
                           transition-all duration-150 tracking-widest uppercase"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={handleDownload}
                title="ログをダウンロード"
                className="text-[10px] px-2 py-0.5 border border-white/10 text-white/30 font-mono
                           hover:border-amber-400/40 hover:text-amber-400
                           transition-all duration-150 tracking-widest uppercase"
              >
                Save
              </button>
            </div>
          )}

          {/* 装飾ドット */}
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500/50" />
            <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
            <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
          </div>
        </div>
      </div>

      {/* ターミナル本体: flexible モードでは flex-1 で親の余白を埋める */}
      <div ref={containerRef}
           className={`overflow-y-auto bg-black/50 border border-white/6 p-4 space-y-1
                      shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]
                      ${flexible ? 'flex-1 min-h-0' : 'h-80'}`}>
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
