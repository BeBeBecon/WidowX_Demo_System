// =====================================
// App.jsx - メインコンポーネント
// WebSocket接続管理・状態管理・2カラムレイアウト
// =====================================
import { useCallback, useEffect, useRef, useState } from 'react'
import CommandInput from './components/CommandInput'
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
        // 3秒後に再接続
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
    // 前回の結果を自動クリアしてから送信
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#080818] to-blue-950 text-white p-6 font-mono">
      {/* 背景グロー装飾 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto space-y-6">
        {/* ヘッダー */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-wider text-white/90">
              WidowX Sub Agent
            </h1>
            <p className="text-xs text-white/40 mt-0.5">LLM-powered ACT Skill Executor</p>
          </div>
          {/* 接続状態インジケーター */}
          <div className="flex items-center gap-2 text-xs text-white/50">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
            {isConnected ? 'Connected' : 'Reconnecting...'}
          </div>
        </header>

        {/* メイン2カラム */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左カラム: 命令入力 → スキル一覧 */}
          <div className="space-y-4">
            <CommandInput
              onSubmit={handleSubmit}
              onEmergencyStop={handleEmergencyStop}
              disabled={isBusy || !isConnected}
              isBusy={isBusy}
            />
            <SkillList skills={skills} selectedSkillId={selectedSkill?.id} />
          </div>

          {/* 右カラム: ステータス → ログ */}
          <div className="space-y-4">
            <StatusPanel
              status={status}
              selectedSkill={selectedSkill}
              onReset={handleReset}
              isBusy={isBusy}
            />
            <LogPanel logs={logs} />
          </div>
        </div>
      </div>
    </div>
  )
}
