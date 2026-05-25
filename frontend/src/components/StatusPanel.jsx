// ----------------
// StatusPanel.jsx
// 現在のシステム状態とLLMが選択したスキルを表示する
// HUDスタイル: アンバー系ステータスインジケーター
// executing 時に経過/全体のプログレスバーと残り秒数を表示
// ----------------
import { useEffect, useRef, useState } from 'react'

// ステータスごとの表示設定
const STATUS_CONFIG = {
  idle:       { label: 'Standby',    sub: '待機中',    color: 'text-amber-400/60',  dot: 'bg-amber-400/50',  glow: '',                                           ring: false },
  connecting: { label: 'Connecting', sub: '接続中',    color: 'text-yellow-300',    dot: 'bg-yellow-300',    glow: 'shadow-[0_0_8px_rgba(250,204,21,0.7)]',      ring: true  },
  thinking:   { label: 'Inference',  sub: 'LLM推論中', color: 'text-amber-300',     dot: 'bg-amber-300',     glow: 'shadow-[0_0_8px_rgba(245,158,11,0.7)]',      ring: true  },
  executing:  { label: 'Executing',  sub: '実行中',    color: 'text-amber-200 neon-text', dot: 'bg-amber-300', glow: 'shadow-[0_0_10px_rgba(245,158,11,0.8)]',   ring: true  },
  done:       { label: 'Complete',   sub: '完了',      color: 'text-emerald-300',   dot: 'bg-emerald-300',   glow: 'shadow-[0_0_8px_rgba(52,211,153,0.7)]',      ring: false },
  error:      { label: 'Error',      sub: 'エラー',    color: 'text-red-300',       dot: 'bg-red-400',       glow: 'shadow-[0_0_8px_rgba(239,68,68,0.7)]',       ring: false },
}

export default function StatusPanel({ status, selectedSkill, onReset, isBusy, episodeTimeS }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle

  // ----------------
  // 経過秒カウンター（executing 中のみ動作）
  // ----------------
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    if (status === 'executing') {
      setElapsed(0)
      timerRef.current = setInterval(() => {
        setElapsed(s => s + 1)
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [status])

  // プログレスバー計算
  const total     = episodeTimeS ?? 20
  // done のとき 100%、それ以外は経過秒から算出
  const progress  = status === 'done' ? 1 : Math.min(elapsed / total, 1)
  const remaining = Math.max(total - elapsed, 0)

  return (
    <div className={`glass p-5 space-y-4 transition-all duration-500 ${
      status === 'executing'
        ? 'border-amber-500/35 shadow-[0_0_25px_rgba(245,158,11,0.07)]'
        : status === 'error'
          ? 'border-red-500/30'
          : ''
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-px h-4 bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
          <h2 className="panel-label">System Status</h2>
        </div>

        {/* リセットボタン: 常時表示、実行中はグレーアウト */}
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
          <div className={`text-2xl font-black tracking-[0.15em] uppercase font-mono ${cfg.color}`}>
            {cfg.label}
          </div>
          <div className="text-sm text-white/40 tracking-widest mt-0.5 font-mono">{cfg.sub}</div>
        </div>
      </div>

      {/* ----------------
          プログレスバー: 常時表示
          executing 中は秒カウントアップで左から充填、done で 100%
          ---------------- */}
      <div className="space-y-1.5">
        {/* バー本体: トラック（外枠）+ フィル（充填） */}
        <div className="h-2 w-full bg-white/6 border border-white/8 overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${
              status === 'done'  ? 'bg-emerald-400/70' :
              status === 'error' ? 'bg-red-400/60'     : 'bg-amber-400/65'
            }`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        {/* テキスト: executing 中のみ表示、それ以外は非表示でスペース確保 */}
        <div className={`flex justify-between text-[10px] font-mono tracking-widest transition-opacity duration-300 ${
          status === 'executing' ? 'opacity-100 text-white/30' : 'opacity-0'
        }`}>
          <span>{elapsed}s elapsed</span>
          <span>{remaining}s remaining</span>
        </div>
      </div>

      {/* LLM選択スキル表示: 常時表示でパネル高さを固定 */}
      <div className="border-t border-white/6 pt-4 space-y-2">
        <p className="text-[10px] text-white/30 tracking-widest uppercase font-mono">Selected Skill</p>
        {selectedSkill ? (
          <div className="flex items-center gap-3 bg-amber-500/5 border border-amber-500/15 px-4 py-3 h-16">
            <span className="text-2xl">{selectedSkill.icon ?? '🤖'}</span>
            <div>
              <p className="font-bold text-amber-200 tracking-wide text-base font-mono">{selectedSkill.name}</p>
              <p className="text-sm text-amber-400/60 mt-0.5">{selectedSkill.description}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 border border-white/6 px-4 py-3 h-16">
            <span className="text-2xl opacity-20">—</span>
            <div>
              <p className="font-bold text-white/20 tracking-wide text-base font-mono">None</p>
              <p className="text-sm text-white/15 mt-0.5">待機中</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
