// ----------------
// FlowDiagram.jsx
// システムの処理フローをリアルタイム可視化するコンポーネント
// statusに応じてノード点灯・エッジのフローアニメーションを切り替える
// レイアウト: [User] → [Client] ↔ [LLM]
//                          ↕
//                       [Arm]
// ----------------

// ----------------
// ステータスごとのアクティブノード・エッジ定義
// ----------------
const FLOW_STATE = {
  idle:       { nodes: [],                                 edge: null,          variant: 'normal'  },
  connecting: { nodes: ['client'],                         edge: null,          variant: 'normal'  },
  thinking:   { nodes: ['client', 'llm'],                  edge: 'client-llm',  variant: 'normal'  },
  executing:  { nodes: ['client', 'arm'],                  edge: 'client-arm',  variant: 'normal'  },
  done:       { nodes: ['user', 'client', 'llm', 'arm'],   edge: null,          variant: 'success' },
  error:      { nodes: ['client'],                         edge: null,          variant: 'error'   },
}

// ----------------
// ノードの表示テキスト定義
// ----------------
const NODE_CONFIG = {
  user:   { label: 'User Input',  sub: 'ユーザー入力' },
  client: { label: 'Client',      sub: 'サーバー'     },
  llm:    { label: 'LLM Engine',  sub: 'AI 推論'      },
  arm:    { label: 'Robot Arm',   sub: 'WidowX'       },
}

// ----------------
// ノードのスタイルをステータスとアクティブ状態から決定する
// ----------------
function getNodeStyle(isActive, variant) {
  // 完了: 全ノード緑
  if (variant === 'success') {
    return {
      border: 'border-emerald-400/60',
      text:   'text-emerald-300',
      bg:     'bg-emerald-500/5',
      glow:   '',
      ring:   false,
    }
  }
  // エラー: アクティブノードのみ赤
  if (variant === 'error' && isActive) {
    return {
      border: 'border-red-500/50',
      text:   'text-red-400',
      bg:     'bg-red-500/5',
      glow:   'shadow-[0_0_12px_rgba(239,68,68,0.25)]',
      ring:   false,
    }
  }
  // 通常アクティブ: アンバー点灯 + リングアニメーション
  if (isActive) {
    return {
      border: 'border-amber-500/60',
      text:   'text-amber-300',
      bg:     'bg-amber-500/[0.08]',
      glow:   'shadow-[0_0_14px_rgba(245,158,11,0.3)]',
      ring:   true,
    }
  }
  // 非アクティブ: 暗め
  return {
    border: 'border-white/10',
    text:   'text-white/25',
    bg:     '',
    glow:   '',
    ring:   false,
  }
}

// ----------------
// ノードコンポーネント
// ----------------
function FlowNode({ id, isActive, variant }) {
  const { label, sub } = NODE_CONFIG[id]
  const s = getNodeStyle(isActive, variant)

  return (
    <div className={`relative flex flex-col items-center justify-center
                     border font-mono text-center
                     w-36 h-16
                     transition-all duration-500
                     ${s.border} ${s.text} ${s.bg} ${s.glow}`}>
      {/* アクティブ時のリングアニメーション */}
      {s.ring && (
        <span className="absolute inset-0 border border-amber-400/30 animate-ping" />
      )}
      <span className="text-xs font-bold tracking-wider uppercase relative z-10">{label}</span>
      <span className="text-[11px] opacity-50 mt-0.5 tracking-widest relative z-10">{sub}</span>
    </div>
  )
}

// ----------------
// 水平エッジ（矢印）コンポーネント
// bidirectional=true のとき両端に矢印、false のとき右向き一方通行
// アクティブ時は flow-line-h クラスでフローアニメーション適用
// ----------------
function HEdge({ isActive, bidirectional, variant }) {
  const isSuccess = variant === 'success'

  const lineClass  = isSuccess ? 'bg-emerald-400/40' : isActive ? '' : 'bg-white/12'
  const arrowRight = isSuccess ? 'border-l-emerald-400/40' : isActive ? 'border-l-amber-400' : 'border-l-white/12'
  const arrowLeft  = isSuccess ? 'border-r-emerald-400/40' : isActive ? 'border-r-amber-400' : 'border-r-white/12'

  return (
    <div className="flex items-center w-10 shrink-0">
      <div className="relative w-full flex items-center gap-0">
        {/* 左矢印（双方向のみ） */}
        {bidirectional && (
          <div className={`shrink-0 w-0 h-0
                           border-t-[3px] border-b-[3px] border-r-[5px] border-transparent
                           ${arrowLeft} transition-colors duration-500`} />
        )}
        {/* ライン本体: アクティブ時はフローアニメーション */}
        <div className={`flex-1 h-[2px] overflow-hidden transition-all duration-500
                         ${isActive && !isSuccess ? 'flow-line-h' : lineClass}`} />
        {/* 右矢印 */}
        <div className={`shrink-0 w-0 h-0
                         border-t-[3px] border-b-[3px] border-l-[5px] border-transparent
                         ${arrowRight} transition-colors duration-500`} />
      </div>
    </div>
  )
}

// ----------------
// 垂直エッジ（双方向矢印）コンポーネント
// アクティブ時は flow-line-v クラスでフローアニメーション適用
// ----------------
function VEdge({ isActive, variant }) {
  const isSuccess = variant === 'success'

  const lineClass   = isSuccess ? 'bg-emerald-400/40' : isActive ? '' : 'bg-white/12'
  const arrowTop    = isSuccess ? 'border-b-emerald-400/40' : isActive ? 'border-b-amber-400' : 'border-b-white/12'
  const arrowBottom = isSuccess ? 'border-t-emerald-400/40' : isActive ? 'border-t-amber-400' : 'border-t-white/12'

  return (
    <div className="flex flex-col items-center h-8">
      {/* 上矢印 */}
      <div className={`w-0 h-0
                       border-l-[3px] border-r-[3px] border-b-[5px] border-transparent
                       ${arrowTop} transition-colors duration-500`} />
      {/* ライン本体 */}
      <div className={`w-[2px] flex-1 overflow-hidden transition-all duration-500
                       ${isActive && !isSuccess ? 'flow-line-v' : lineClass}`} />
      {/* 下矢印 */}
      <div className={`w-0 h-0
                       border-l-[3px] border-r-[3px] border-t-[5px] border-transparent
                       ${arrowBottom} transition-colors duration-500`} />
    </div>
  )
}

// ----------------
// メインコンポーネント
// ----------------
export default function FlowDiagram({ status }) {
  const state = FLOW_STATE[status] ?? FLOW_STATE.idle
  const isActive = (id) => state.nodes.includes(id)

  // コマンド送信済み（ユーザー → Client の矢印は idle 以外でアクティブ）
  const userToClientActive = status !== 'idle'
  const clientLlmActive    = state.edge === 'client-llm'
  const clientArmActive    = state.edge === 'client-arm'

  return (
    <div className="glass p-5 space-y-4">
      {/* セクションヘッダー */}
      <div className="flex items-center gap-2">
        <div className="w-px h-4 bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
        <h2 className="panel-label">System Flow</h2>
      </div>

      {/* フロー図本体: CSS grid で位置を確定させる */}
      <div className="flex justify-center py-1">
        <div
          className="grid"
          style={{
            gridTemplateColumns: '144px 40px 144px 40px 144px',
            gridTemplateRows: 'auto auto auto',
            alignItems: 'center',
            justifyItems: 'center',
          }}
        >
          {/* ---- 1行目: User → Client ↔ LLM ---- */}
          <div style={{ gridColumn: 1, gridRow: 1 }}>
            <FlowNode id="user"   isActive={isActive('user')}   variant={state.variant} />
          </div>
          <div style={{ gridColumn: 2, gridRow: 1 }} className="w-full flex items-center">
            <HEdge isActive={userToClientActive} bidirectional={false} variant={state.variant} />
          </div>
          <div style={{ gridColumn: 3, gridRow: 1 }}>
            <FlowNode id="client" isActive={isActive('client')} variant={state.variant} />
          </div>
          <div style={{ gridColumn: 4, gridRow: 1 }} className="w-full flex items-center">
            <HEdge isActive={clientLlmActive} bidirectional variant={state.variant} />
          </div>
          <div style={{ gridColumn: 5, gridRow: 1 }}>
            <FlowNode id="llm"    isActive={isActive('llm')}    variant={state.variant} />
          </div>

          {/* ---- 2行目: Client ↕ Arm の縦矢印 ---- */}
          <div style={{ gridColumn: 3, gridRow: 2 }}>
            <VEdge isActive={clientArmActive} variant={state.variant} />
          </div>

          {/* ---- 3行目: Arm（Client 真下） ---- */}
          <div style={{ gridColumn: 3, gridRow: 3 }}>
            <FlowNode id="arm"    isActive={isActive('arm')}    variant={state.variant} />
          </div>
        </div>
      </div>
    </div>
  )
}
