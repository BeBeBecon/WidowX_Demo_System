// ----------------
// StatusPanel.jsx
// 現在のシステム状態とLLMが選択したスキルを表示する
// HUDスタイル: ネオン色のステータスインジケーター
// ----------------

// ステータスごとの表示設定
const STATUS_CONFIG = {
  idle:       { label: 'Standby',    sub: '待機中',    color: 'text-cyan-500/50',  dot: 'bg-cyan-500/40',   glow: '',                                          ring: false },
  connecting: { label: 'Connecting', sub: '接続中',    color: 'text-yellow-400',   dot: 'bg-yellow-400',    glow: 'shadow-[0_0_8px_rgba(250,204,21,0.8)]',     ring: true  },
  thinking:   { label: 'Inference',  sub: 'LLM推論中', color: 'text-amber-300',    dot: 'bg-amber-400',     glow: 'shadow-[0_0_8px_rgba(251,191,36,0.8)]',     ring: true  },
  executing:  { label: 'Executing',  sub: '実行中',    color: 'text-cyan-300 neon-text', dot: 'bg-cyan-400', glow: 'shadow-[0_0_10px_rgba(0,229,255,0.9)]',    ring: true  },
  done:       { label: 'Complete',   sub: '完了',      color: 'text-emerald-400',  dot: 'bg-emerald-400',   glow: 'shadow-[0_0_8px_rgba(52,211,153,0.8)]',     ring: false },
  error:      { label: 'Error',      sub: 'エラー',    color: 'text-red-400',      dot: 'bg-red-500',       glow: 'shadow-[0_0_8px_rgba(239,68,68,0.8)]',      ring: false },
}

export default function StatusPanel({ status, selectedSkill, onReset, isBusy }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle

  return (
    <div className={`glass p-5 space-y-4 transition-all duration-500 ${
      status === 'executing'
        ? 'border-cyan-500/40 shadow-[0_0_30px_rgba(0,229,255,0.08)]'
        : status === 'error'
          ? 'border-red-500/30'
          : ''
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-px h-4 bg-cyan-400 shadow-[0_0_6px_rgba(0,229,255,0.8)]" />
          <h2 className="panel-label">System Status</h2>
        </div>

        {/* リセットボタン: 常時表示、実行中はグレーアウト */}
        <button
          onClick={onReset}
          disabled={isBusy}
          className="text-[10px] px-3 py-1 border border-cyan-500/20 text-cyan-500/40
                     hover:border-cyan-500/50 hover:text-cyan-400
                     disabled:opacity-20 disabled:cursor-not-allowed
                     tracking-widest uppercase transition-all duration-200 rounded-none"
        >
          Reset
        </button>
      </div>

      {/* ステータスインジケーター（大型表示） */}
      <div className="flex items-center gap-4 py-2">
        {/* ドットインジケーター */}
        <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
          {cfg.ring && (
            <span className={`absolute inline-flex w-5 h-5 rounded-full ${cfg.dot} opacity-40 animate-ping`} />
          )}
          <span className={`relative w-3 h-3 rounded-full ${cfg.dot} ${cfg.glow}`} />
        </div>

        <div>
          <div className={`text-2xl font-black tracking-[0.15em] uppercase ${cfg.color}`}>
            {cfg.label}
          </div>
          <div className="text-sm text-white/25 tracking-widest mt-0.5">{cfg.sub}</div>
        </div>
      </div>

      {/* 実行中: プログレスバー */}
      {status === 'executing' && (
        <div className="h-px w-full bg-cyan-500/10 overflow-hidden">
          <div className="h-full bg-cyan-400/60 animate-[progress_2s_ease-in-out_infinite]"
               style={{ animation: 'pulse 1.5s ease-in-out infinite, width 2s linear' }} />
        </div>
      )}

      {/* LLM選択スキル表示 */}
      {selectedSkill && (
        <div className="border-t border-cyan-500/10 pt-4 space-y-2">
          <p className="text-[10px] text-cyan-500/40 tracking-widest uppercase">Selected Skill</p>
          <div className="flex items-center gap-3 bg-cyan-500/5 border border-cyan-500/15 px-4 py-3">
            <span className="text-2xl">{selectedSkill.icon ?? '🤖'}</span>
            <div>
              <p className="font-bold text-cyan-200 tracking-wide text-base">{selectedSkill.name}</p>
              <p className="text-sm text-cyan-500/50 mt-0.5">{selectedSkill.description}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
