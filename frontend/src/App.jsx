// =====================================
// App.jsx - メインコンポーネント
// WebSocket接続管理・状態管理・2カラムレイアウト
// テーマ: Engineering Control（スレートグレー × アンバー）
// =====================================
import { useCallback, useEffect, useRef, useState } from 'react'
import CommandInput from './components/CommandInput'
import FlowDiagram from './components/FlowDiagram'
import LogPanel from './components/LogPanel'
import SkillList from './components/SkillList'
import StatusPanel from './components/StatusPanel'

// WebSocket URLを環境変数またはプロキシ経由で解決
const WS_URL = import.meta.env.VITE_WS_URL || `ws://${location.host}/ws`

export default function App() {
  // ----------------
  // 状態定義
  // ----------------
  const [status, setStatus]          = useState('idle')   // idle|connecting|thinking|executing|done|error
  const [skills, setSkills]          = useState([])       // config.json のスキル一覧
  const [selectedSkill, setSelected] = useState(null)     // LLMが選択したスキル
  const [logs, setLogs]              = useState([])       // 実行ログ行配列
  const [isConnected, setConnected]  = useState(false)    // WebSocket接続状態

  const wsRef = useRef(null)

  // ----------------
  // WebSocket初期化・自動再接続
  // ----------------
  useEffect(() => {
    const connect = () => {
      setStatus('connecting')
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        setStatus('idle')
      }

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data)
        handleMessage(msg)
      }

      ws.onclose = () => {
        setConnected(false)
        setStatus('idle')
        setTimeout(connect, 3000)
      }

      ws.onerror = () => ws.close()
    }

    connect()
    return () => wsRef.current?.close()
  }, [])

  // ----------------
  // スキル一覧の取得（REST）
  // ----------------
  useEffect(() => {
    fetch('/api/skills')
      .then(r => r.json())
      .then(setSkills)
      .catch(() => {})
  }, [])

  // ----------------
  // WebSocketメッセージハンドラー
  // ----------------
  const handleMessage = (msg) => {
    switch (msg.type) {
      case 'status':
        setStatus(msg.status)
        break
      case 'llm_result':
        setSelected(msg.skill)
        break
      case 'log':
        setLogs(prev => [...prev, msg.line])
        break
      case 'error':
        setLogs(prev => [...prev, `[ERROR] ${msg.message}`])
        setStatus('error')
        break
    }
  }

  const isBusy = status === 'thinking' || status === 'executing' || status === 'connecting'

  // ----------------
  // 初期状態へリセット（selectedSkill・ログも含めて全クリア）
  // ----------------
  const handleReset = () => {
    setStatus('idle')
    setSelected(null)
    setLogs([])
  }

  // ----------------
  // コマンド送信（done/error状態でも自動リセットして再送可能）
  // ----------------
  const handleSubmit = useCallback((command) => {
    if (!isConnected || isBusy) return
    setSelected(null)
    setLogs([])
    setStatus('idle')
    wsRef.current.send(JSON.stringify({ command }))
  }, [isConnected, isBusy])

  // ----------------
  // 緊急停止（実行中のサブプロセスをバックエンドで強制終了させる）
  // ----------------
  const handleEmergencyStop = useCallback(() => {
    if (!isConnected || !isBusy) return
    wsRef.current.send(JSON.stringify({ action: 'stop' }))
  }, [isConnected, isBusy])

  // ----------------
  // レイアウト描画
  // ----------------
  return (
    <div className="min-h-screen text-white p-8 font-mono">
      {/* 隅のグロー装飾（控えめなアンバー） */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-[600px] h-[300px] bg-amber-500/3 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[300px] bg-amber-500/3 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="relative max-w-7xl mx-auto space-y-5">

        {/* =====================================
            ヘッダー: システム識別バー
            ===================================== */}
        <header className="border border-white/8 bg-[#161b22]/90 rounded-sm px-5 py-3
                           shadow-[0_0_30px_rgba(245,158,11,0.04)]">
          <div className="flex items-center justify-between">
            {/* 左: システム名 */}
            <div className="flex items-center gap-4">
              {/* アクセントバー */}
              <div className="w-1 h-8 bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-black tracking-[0.15em] text-amber-300 neon-text uppercase"
                      style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
                    WidowX Sub Agent
                  </h1>
                  <span className="text-[10px] px-2 py-0.5 border border-amber-500/40 text-amber-500/70 tracking-widest font-mono">
                    v1.0
                  </span>
                </div>
                <p className="text-[10px] text-amber-400/50 tracking-[0.15em] uppercase mt-0.5 font-mono">
                  LLM-Powered ACT Skill Executor
                </p>
              </div>
            </div>

            {/* 右: 接続ステータス */}
            <div className="flex items-center gap-5 text-[10px] tracking-widest uppercase font-mono">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  isConnected
                    ? 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)] animate-pulse'
                    : 'bg-red-500'
                }`} />
                <span className={isConnected ? 'text-amber-300' : 'text-red-300'}>
                  {isConnected ? 'System Online' : 'Reconnecting'}
                </span>
              </div>
              {/* 装飾的な区切り */}
              <div className="text-white/15">|</div>
              <span className="text-white/25">WS://LOCALHOST</span>
            </div>
          </div>
        </header>

        {/* =====================================
            メイン2カラム
            ===================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* 左カラム: 命令入力 → スキル一覧 */}
          <div className="space-y-5">
            <CommandInput
              onSubmit={handleSubmit}
              onEmergencyStop={handleEmergencyStop}
              disabled={isBusy || !isConnected}
              isBusy={isBusy}
            />
            <SkillList skills={skills} selectedSkillId={selectedSkill?.id} />
          </div>

          {/* 右カラム: ステータス → フロー図 → ログ */}
          <div className="space-y-5">
            <StatusPanel
              status={status}
              selectedSkill={selectedSkill}
              onReset={handleReset}
              isBusy={isBusy}
            />
            <FlowDiagram status={status} />
            <LogPanel logs={logs} />
          </div>

        </div>
      </div>
    </div>
  )
}
