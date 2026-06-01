// =====================================
// App.jsx - メインコンポーネント
// WebSocket接続管理・状態管理・3カラムレイアウト
// 左: 命令入力 + ステータス / 中: スキル一覧 + FAQ / 右: フロー図 + ログ
// テーマ: Engineering Control（スレートグレー × アンバー）
// =====================================
import { useCallback, useEffect, useRef, useState } from 'react'
import CommandInput from './components/CommandInput'
import FaqPanel from './components/FaqPanel'
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
  const [isDryRun, setDryRun]        = useState(null)     // DRY_RUNモードフラグ（null=未取得）
  const [modelMode, setModelMode]    = useState(null)     // ACT | OPENVLA（null=未取得）
  const [vlaOnline, setVlaOnline]    = useState(null)     // OpenVLAモード時の VLA Server 死活（null=未確認）

  // ----------------
  // 追加状態: 実行履歴 / スキル入力補完 / エピソード時間
  // ----------------
  const [prefill, setPrefill]           = useState({ text: '', seq: 0 }) // CommandInput へのワンクリック入力（seq で同一テキスト再クリックを検知）
  const [episodeTimeS, setEpisodeTimeS] = useState(null)             // config の episode_time_s（プログレスバー用）
  const [isFullscreen, setFullscreen]   = useState(false)            // 全画面モード状態
  const [direction, setDirection]       = useState(null)             // OpenCV チームからの現在 direction（null=未取得）
  const [overrideDirection, setOverrideDirection] = useState(null)  // CommandInput プルダウンで手動選択した方向（null=None）
  const [predefinedQa, setPredefinedQa] = useState([])              // FAQパネル用の定型質問一覧
  const [commandTemplates, setCommandTemplates] = useState({})       // direction_aware コマンドテキスト生成テンプレート

  const wsRef = useRef(null)

  // ----------------
  // 実行追跡用 Ref（stale closure を避けるため ref で管理）
  // ----------------
  const execStartRef      = useRef(null)   // 実行開始時刻 (ms)
  const currentCommandRef = useRef('')     // 現在実行中のコマンドテキスト
  const currentSkillRef   = useRef(null)  // 現在実行中のスキルオブジェクト

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
  // 全画面モード: fullscreenchange でEscキー退出にも追従
  // ----------------
  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const handleFullscreenToggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  // ----------------
  // 実行モード取得（DRY_RUN・episode_time_s・model_mode）
  // ----------------
  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(d => {
        setDryRun(d.dry_run)
        if (d.episode_time_s != null) setEpisodeTimeS(d.episode_time_s)
        if (d.model_mode)             setModelMode(d.model_mode)
      })
      .catch(() => {})
  }, [])

  // ----------------
  // OpenVLA モード時: VLA Server 死活を定期ポーリング（10秒間隔）
  // ----------------
  useEffect(() => {
    if (modelMode !== 'OPENVLA') return
    const poll = () =>
      fetch('/api/openvla/status')
        .then(r => r.json())
        .then(d => setVlaOnline(d.online))
        .catch(() => setVlaOnline(false))
    poll()
    const id = setInterval(poll, 10000)
    return () => clearInterval(id)
  }, [modelMode])

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
  // 公開設定取得: FAQリスト・コマンドテンプレートを /api/config から取得
  // ----------------
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(d => {
        if (d.llm?.predefined_qa)  setPredefinedQa(d.llm.predefined_qa)
        if (d.command_templates)   setCommandTemplates(d.command_templates)
      })
      .catch(() => {})
  }, [])

  // ----------------
  // direction 定期ポーリング（3秒間隔）
  // OpenCV チームから POST /internal/direction で更新される向き情報を反映
  // ----------------
  useEffect(() => {
    const poll = () =>
      fetch('/internal/direction')
        .then(r => r.json())
        .then(d => setDirection(d.direction))
        .catch(() => {})
    poll()
    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [])

  // ----------------
  // WebSocketメッセージハンドラー
  // ----------------
  const handleMessage = (msg) => {
    switch (msg.type) {
      case 'status':
        setStatus(msg.status)
        // executing 開始: 実行開始時刻を記録
        if (msg.status === 'executing') {
          execStartRef.current = Date.now()
        }
        if (msg.status === 'done' || msg.status === 'error') {
          execStartRef.current = null
        }
        break
      case 'llm_result':
        setSelected(msg.skill)
        currentSkillRef.current = msg.skill
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
    currentCommandRef.current = command
    currentSkillRef.current   = null
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
                  LLM-Powered Teleoperation Skill Executor
                </p>
              </div>
            </div>

            {/* 右: モードバッジ + 接続ステータス */}
            <div className="flex items-center gap-5 text-[10px] tracking-widest uppercase font-mono">

              {/* model_mode バッジ（読み取り専用） */}
              {modelMode && (
                modelMode === 'OPENVLA' ? (
                  <span className="px-2.5 py-1 border border-violet-500/60 text-violet-300
                                   bg-violet-500/10 tracking-widest font-bold
                                   shadow-[0_0_10px_rgba(139,92,246,0.2)]">
                    OpenVLA
                  </span>
                ) : modelMode === 'TELEOP' ? (
                  <span className="px-2.5 py-1 border border-teal-500/60 text-teal-300
                                   bg-teal-500/10 tracking-widest font-bold
                                   shadow-[0_0_10px_rgba(20,184,166,0.2)]">
                    Teleop
                  </span>
                ) : (
                  <span className="px-2.5 py-1 border border-cyan-500/50 text-cyan-400/80
                                   bg-cyan-500/8 tracking-widest font-bold">
                    {modelMode}
                  </span>
                )
              )}

              {/* OpenVLA モード時: VLA Server 死活インジケータ */}
              {modelMode === 'OPENVLA' && (
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    vlaOnline === null ? 'bg-white/20' :
                    vlaOnline          ? 'bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.8)] animate-pulse'
                                       : 'bg-red-500'
                  }`} />
                  <span className={
                    vlaOnline === null ? 'text-white/30' :
                    vlaOnline          ? 'text-violet-300' : 'text-red-400'
                  }>
                    {vlaOnline === null ? 'VLA ...' : vlaOnline ? 'VLA Online' : 'VLA Offline'}
                  </span>
                </div>
              )}

              {/* direction バッジ（OpenCV チームからの向き情報） */}
              {direction && (
                <span className={`px-2.5 py-1 border tracking-widest font-bold font-mono text-[10px] uppercase
                  ${direction === 'right'  ? 'border-sky-500/50 text-sky-300 bg-sky-500/8'   :
                    direction === 'left'   ? 'border-sky-500/50 text-sky-300 bg-sky-500/8'   :
                                            'border-sky-500/30 text-sky-400/60 bg-sky-500/4' }
                `}>
                  {direction === 'right' ? '▶ RIGHT' : direction === 'left' ? '◀ LEFT' : '● CENTER'}
                </span>
              )}

              {/* DRY_RUN / LIVE モードバッジ */}
              {isDryRun !== null && (
                isDryRun ? (
                  <span className="px-2.5 py-1 border border-orange-500/60 text-orange-400
                                   bg-orange-500/10 tracking-widest font-bold
                                   shadow-[0_0_10px_rgba(249,115,22,0.2)]">
                    SIM MODE
                  </span>
                ) : (
                  <span className="px-2.5 py-1 border border-red-500/70 text-red-400
                                   bg-red-500/10 tracking-widest font-bold
                                   shadow-[0_0_10px_rgba(239,68,68,0.25)] animate-pulse">
                    LIVE
                  </span>
                )
              )}

              <div className="text-white/15">|</div>

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

              <div className="text-white/15">|</div>

              {/* 全画面トグルボタン */}
              <button
                onClick={handleFullscreenToggle}
                className={`px-2.5 py-1 border font-mono tracking-widest transition-all duration-200
                  ${isFullscreen
                    ? 'border-white/30 text-white/70 hover:border-white/60 hover:text-white'
                    : 'border-amber-500/30 text-amber-500/50 hover:border-amber-400/60 hover:text-amber-300'
                  }`}
              >
                {isFullscreen ? '✕  EXIT FULL' : '⛶  FULLSCREEN'}
              </button>
            </div>
          </div>
        </header>

        {/* =====================================
            外側レイアウト: メインパネル + 右サイドパネル（将来用・現在非表示）
            ===================================== */}
        <div className="flex gap-6 items-start">

          {/* =====================================
              3カラムグリッド: 左=入力操作 / 中=スキル一覧 / 右=ステータス・ログ
              items-stretch + h-full flex-col で各列の底辺を揃える
              ===================================== */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">

              {/* 左カラム: スキル一覧（方向プルダウン付き・固定）+ FAQ（残り高さを埋める） */}
              <div className="flex flex-col gap-5 h-full">
                <SkillList
                  skills={skills}
                  selectedSkillId={selectedSkill?.id}
                  onSelect={cmd => setPrefill(prev => ({ text: cmd, seq: prev.seq + 1 }))}
                  globalDirection={overrideDirection ?? direction}
                  onDirectionChange={dir => setOverrideDirection(dir)}
                  commandTemplates={commandTemplates}
                />
                <div className="flex-1 min-h-0">
                  <FaqPanel
                    predefinedQa={predefinedQa}
                    onSelect={q => setPrefill(prev => ({ text: q, seq: prev.seq + 1 }))}
                    disabled={isBusy || !isConnected}
                  />
                </div>
              </div>

              {/* 中カラム: 命令入力（固定） + ステータス（残り高さを埋める） */}
              <div className="flex flex-col gap-5 h-full">
                <CommandInput
                  onSubmit={handleSubmit}
                  onEmergencyStop={handleEmergencyStop}
                  disabled={isBusy || !isConnected}
                  isBusy={isBusy}
                  prefill={prefill}
                />
                <div className="flex-1 min-h-0">
                  <StatusPanel
                    status={status}
                    selectedSkill={selectedSkill}
                    onReset={handleReset}
                    isBusy={isBusy}
                    episodeTimeS={episodeTimeS}
                  />
                </div>
              </div>

              {/* 右カラム: フロー図（固定）+ ログ（残り高さを埋める） */}
              <div className="flex flex-col gap-5 h-full">
                <FlowDiagram status={status} />
                <div className="flex-1 min-h-0">
                  <LogPanel logs={logs} flexible />
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
