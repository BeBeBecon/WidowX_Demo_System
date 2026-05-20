// ----------------
// StatusPanel.jsx
// 現在のシステム状態とLLMが選択したスキルを表示する
// リセットボタンは常時表示し、実行中はグレーアウト（誤作動防止）
// ----------------

// ステータスごとの表示設定
const STATUS_CONFIG = {
  idle:       { label: '待機中',    color: 'text-white/40',    dot: 'bg-white/30',    ring: '' },
  connecting: { label: '接続中',    color: 'text-yellow-400',  dot: 'bg-yellow-400',  ring: 'animate-pulse' },
  thinking:   { label: 'LLM推論中', color: 'text-amber-400',   dot: 'bg-amber-400',   ring: 'animate-pulse' },
  executing:  { label: '実行中',    color: 'text-blue-400',    dot: 'bg-blue-400',    ring: 'animate-ping' },
  done:       { label: '完了',      color: 'text-emerald-400', dot: 'bg-emerald-400', ring: '' },
  error:      { label: 'エラー',    color: 'text-red-400',     dot: 'bg-red-400',     ring: '' },
}

export default function StatusPanel({ status, selectedSkill, onReset, isBusy }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle

  return (
    <div className="glass p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest">
        Status
      </h2>

      {/* ステータスインジケーター */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-4 h-4">
          {cfg.ring && (
            <span className={`absolute inline-flex w-4 h-4 rounded-full ${cfg.dot} opacity-50 ${cfg.ring}`} />
          )}
          <span className={`relative w-3 h-3 rounded-full ${cfg.dot}`} />
        </div>
        <span className={`text-lg font-bold ${cfg.color}`}>{cfg.label}</span>

        {/* リセットボタン: 常時表示、実行中はグレーアウト */}
        <button
          onClick={onReset}
          disabled={isBusy}
          className="ml-auto text-xs px-3 py-1 rounded-lg bg-white/5 border border-white/10
                     hover:bg-white/10 text-white/50 hover:text-white/80 transition-all
                     disabled:opacity-25 disabled:cursor-not-allowed"
        >
          リセット
        </button>
      </div>

      {/* LLM選択スキル表示 */}
      {selectedSkill && (
        <div className="border-t border-white/10 pt-4 space-y-1">
          <p className="text-xs text-white/40">選択されたスキル</p>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{selectedSkill.icon ?? '🤖'}</span>
            <div>
              <p className="font-semibold text-white/90">{selectedSkill.name}</p>
              <p className="text-xs text-white/40">{selectedSkill.description}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
