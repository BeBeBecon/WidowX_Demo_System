// =====================================
// DemoExamplePanel.jsx
// デモ用入力例パネル（左カラム全体を占有）
// skill_examples と conversation_examples を config.json から受け取り、
// ワンクリックで CommandInput にテキストをセットする
// テーマ: スレートグレー × アンバー（glass クラス準拠）
// =====================================


// ----------------
// 各例のクリック可能な行コンポーネント
// ----------------
function ExampleRow({ text, hint, onSelect, disabled }) {
  return (
    <button
      onClick={() => onSelect(text)}
      disabled={disabled}
      className="w-full text-left group px-3 py-2 border border-transparent
                 hover:border-amber-500/20 hover:bg-amber-500/4
                 disabled:opacity-30 disabled:cursor-not-allowed
                 transition-all duration-150"
    >
      <div className="flex items-start gap-2">
        <span className="text-amber-500/50 font-mono text-xs mt-0.5 shrink-0
                         group-hover:text-amber-400 transition-colors">▸</span>
        <div className="min-w-0">
          <p className="text-sm text-white/70 font-mono leading-snug
                        group-hover:text-amber-100 transition-colors truncate">
            {text}
          </p>
          {hint && (
            <p className="text-[10px] text-white/25 mt-0.5 font-mono">💬 {hint}</p>
          )}
        </div>
      </div>
    </button>
  )
}


// =====================================
// DemoExamplePanel コンポーネント
// Props:
//   demoExamples : { skill_examples: [...], conversation_examples: [...] }
//   onSelect     : (text: string) => void  クリック時のコールバック
//   disabled     : boolean  実行中など操作不可時
// =====================================
export default function DemoExamplePanel({ demoExamples, onSelect, disabled }) {
  const skillExamples        = demoExamples?.skill_examples        ?? []
  const conversationExamples = demoExamples?.conversation_examples ?? []

  return (
    <div className="glass p-5 h-full flex flex-col">

      {/* ----------------
          ヘッダー
          ---------------- */}
      <div className="flex items-center gap-3 shrink-0 mb-4">
        <div className="w-px h-4 bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
        <h2 className="panel-label">Demo Example</h2>
      </div>

      {/* ----------------
          スクロール可能な例一覧エリア（flex-1 + overflow-y-auto で内部スクロール）
          ---------------- */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-5 pr-1
                      [&::-webkit-scrollbar]:w-1
                      [&::-webkit-scrollbar-track]:bg-transparent
                      [&::-webkit-scrollbar-thumb]:bg-white/10
                      [&::-webkit-scrollbar-thumb:hover]:bg-amber-500/30">

        {/* ----------------
            SKILL セクション
            ---------------- */}
        {skillExamples.length > 0 && (
          <div>
            <p className="text-[10px] text-white/30 tracking-widest uppercase font-mono mb-2 px-1">
              Skill
            </p>
            <div className="flex flex-col">
              {skillExamples.map((ex, i) => (
                <ExampleRow
                  key={i}
                  text={ex.text}
                  hint={ex.hint}
                  onSelect={onSelect}
                  disabled={disabled}
                />
              ))}
            </div>
          </div>
        )}

        {/* ----------------
            CONVERSATION セクション
            ---------------- */}
        {conversationExamples.length > 0 && (
          <div>
            <p className="text-[10px] text-white/30 tracking-widest uppercase font-mono mb-2 px-1">
              Conversation
            </p>
            <div className="flex flex-col">
              {conversationExamples.map((ex, i) => (
                <ExampleRow
                  key={i}
                  text={ex.text}
                  hint={ex.hint}
                  onSelect={onSelect}
                  disabled={disabled}
                />
              ))}
            </div>
          </div>
        )}

        {/* データ未取得時のプレースホルダー */}
        {skillExamples.length === 0 && conversationExamples.length === 0 && (
          <p className="text-white/20 text-xs font-mono px-1">読み込み中...</p>
        )}

      </div>
    </div>
  )
}
