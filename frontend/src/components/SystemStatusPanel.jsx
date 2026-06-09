// =====================================
// SystemStatusPanel.jsx
// LLMとの対話情報を一元集約するシステムステータスパネル
// ステータス表示・LLM返答・選択スキルをすべて1パネルに統合
// テーマ: スレートグレー × アンバー（glass クラス準拠）
// =====================================

// ----------------
// ステータスごとの表示設定（STATUS_CONFIGで一元管理）
// face: ステータスラベル右に大きく表示するロボット表情（絵文字）
// ----------------
const STATUS_CONFIG = {
  idle:       { label: 'Standby',    sub: '待機中',    color: 'text-amber-400/60',        dot: 'bg-amber-400/50',  glow: '',                                         ring: false, face: '( ・ω・ )', faceCls: 'text-white/20' },
  connecting: { label: 'Connecting', sub: '接続中',    color: 'text-yellow-300',          dot: 'bg-yellow-300',    glow: 'shadow-[0_0_8px_rgba(250,204,21,0.7)]',    ring: true,  face: '( ・ω・ )', faceCls: 'text-yellow-300/50 animate-pulse' },
  thinking:   { label: 'Inference',  sub: 'LLM推論中', color: 'text-amber-300',           dot: 'bg-amber-300',     glow: 'shadow-[0_0_8px_rgba(245,158,11,0.7)]',    ring: true,  face: '( ・・・ )', faceCls: 'text-amber-300 animate-pulse' },
  executing:  { label: 'Executing',  sub: '実行中',    color: 'text-amber-200 neon-text', dot: 'bg-amber-300',     glow: 'shadow-[0_0_10px_rgba(245,158,11,0.8)]',   ring: true,  face: '( ≡ω≡ )', faceCls: 'text-amber-200 animate-[pulse_1.2s_ease-in-out_infinite]' },
  done:       { label: 'Complete',   sub: '完了',      color: 'text-emerald-300',         dot: 'bg-emerald-300',   glow: 'shadow-[0_0_8px_rgba(52,211,153,0.7)]',    ring: false, face: '( ^ω^ )',  faceCls: 'text-emerald-300' },
  error:      { label: 'Error',      sub: 'エラー',    color: 'text-red-300',             dot: 'bg-red-400',       glow: 'shadow-[0_0_8px_rgba(239,68,68,0.7)]',     ring: false, face: '( ；ω；)',  faceCls: 'text-red-300' },
}


// ----------------
// thinking中ドットアニメーション（3つが順番に点灯）
// ----------------
function ThinkingDots() {
  return (
    <div className="flex items-center gap-2 py-3 px-1">
      {[0, 0.28, 0.56].map((delay, i) => (
        <span
          key={i}
          className="thinking-dot w-2.5 h-2.5 rounded-full bg-amber-400"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  )
}


// =====================================
// SystemStatusPanel コンポーネント
// Props:
//   status       : idle|connecting|thinking|executing|done|error
//   selectedSkill: LLMが選択したスキルオブジェクト（null可）
//   onReset      : リセットコールバック
//   isBusy       : 実行中フラグ（リセット無効化用）
//   llmReply     : 最新のLLM返答テキスト
//   prevLlmReply : 1つ前のLLM返答テキスト（薄く表示）
// =====================================
export default function SystemStatusPanel({
  status,
  selectedSkill,
  onReset,
  isBusy,
  llmReply,
  prevLlmReply,
}) {
  const cfg        = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle
  const isThinking = status === 'thinking'
  const isError    = status === 'error'

  return (
    <div className={`glass p-5 h-full flex flex-col gap-4 transition-all duration-500 ${
      status === 'executing'
        ? 'border-amber-500/35 shadow-[0_0_25px_rgba(245,158,11,0.07)]'
        : isError
          ? 'border-red-500/30'
          : ''
    }`}>

      {/* ----------------
          ヘッダー: タイトル + リセットボタン（右上固定）
          ---------------- */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-px h-4 bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
          <h2 className="panel-label">System Status</h2>
        </div>
        <button
          onClick={onReset}
          disabled={isBusy}
          className="text-[10px] px-3 py-1 border border-white/10 text-white/30 font-mono
                     hover:border-amber-500/40 hover:text-amber-400
                     disabled:opacity-20 disabled:cursor-not-allowed
                     tracking-widest uppercase transition-all duration-200 rounded-none"
        >
          Reset
        </button>
      </div>

      {/* ----------------
          ステータスインジケーター
          顔文字はラベルテキストの真横に配置（「COMPLETE ( ^ω^ )」の形）
          ---------------- */}
      <div className="flex items-center gap-4 py-1 shrink-0">
        <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
          {cfg.ring && (
            <span className={`absolute inline-flex w-5 h-5 rounded-full ${cfg.dot} opacity-40 animate-ping`} />
          )}
          <span className={`relative w-3 h-3 rounded-full ${cfg.dot} ${cfg.glow}`} />
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black tracking-[0.15em] uppercase font-mono ${cfg.color}`}>
              {cfg.label}
            </span>
            <span className={`text-2xl font-black font-mono select-none leading-none ${cfg.faceCls}`}>{cfg.face}</span>
          </div>
          <div className="text-sm text-white/40 tracking-widest mt-0.5 font-mono">{cfg.sub}</div>
        </div>
      </div>

      {/* ----------------
          LLM Reply ボックス（吹き出し風）
          - thinking中: ドットアニメーション
          - 受信後: 返答テキスト表示
          - 1つ前の返答を薄く残す（最大2件）
          ---------------- */}
      <div className="border-t border-white/6 pt-4 flex flex-col gap-2 flex-1 min-h-0">
        <p className="text-[10px] text-white/30 tracking-widest uppercase font-mono shrink-0">
          LLM Reply
        </p>

        <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0">

          {/* 1つ前の返答（薄く表示・thinking中は非表示） */}
          {prevLlmReply && !isThinking && (
            <div className="px-3 py-2 border-l-2 border-white/10 opacity-30">
              <p className="text-xs text-white/60 font-mono leading-relaxed">{prevLlmReply}</p>
            </div>
          )}

          {/* 現在の返答 or thinking中ドット */}
          <div className={`px-3 py-2 border-l-2 ${
            isError
              ? 'border-red-500/50 bg-red-500/5'
              : 'border-amber-500/30'
          }`}>
            {isThinking ? (
              <ThinkingDots />
            ) : llmReply ? (
              <p className={`text-sm font-mono leading-relaxed ${
                isError ? 'text-red-300' : 'text-amber-100'
              }`}>
                {llmReply}
              </p>
            ) : (
              <p className="text-sm text-white/20 font-mono py-1">—</p>
            )}
          </div>

        </div>
      </div>

      {/* ----------------
          Selected Skill: スキルありのみ表示（なし時はスペース確保しない）
          ---------------- */}
      {selectedSkill && (
        <div className="border-t border-white/6 pt-4 space-y-2 shrink-0">
          <p className="text-[10px] text-white/30 tracking-widest uppercase font-mono">
            Selected Skill
          </p>
          <div className="flex items-center gap-3 bg-amber-500/5 border border-amber-500/15 px-4 py-3">
            <span className="text-2xl">{selectedSkill.icon ?? '🤖'}</span>
            <div>
              <p className="font-bold text-amber-200 tracking-wide text-base font-mono">
                {selectedSkill.name}
              </p>
              <p className="text-sm text-amber-400/60 mt-0.5">{selectedSkill.description}</p>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
