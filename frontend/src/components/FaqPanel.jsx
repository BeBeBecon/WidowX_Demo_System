// ----------------
// FaqPanel.jsx
// config.json の llm.predefined_qa に定義したFAQ質問をクリッカブルボタンで表示。
// クリックで質問テキストを CommandInput にセットし、LLMが yes/no リアクションを判断する。
// LLMをバイパスせず、テキストとして流して通常フローで処理させる設計。
// ----------------

export default function FaqPanel({ predefinedQa, onSelect, disabled }) {
  if (!predefinedQa || predefinedQa.length === 0) return null

  return (
    <div className="glass p-5 flex flex-col gap-3 h-full overflow-hidden">
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-px h-4 bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
        <h2 className="panel-label">FAQ</h2>
        <span className="ml-auto text-[10px] text-white/30 tracking-widest font-mono">
          {predefinedQa.length} ITEMS
        </span>
      </div>

      {/* FAQ ボタン一覧: overflow時はスクロール */}
      <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 min-h-0">
        {predefinedQa.map((item, idx) => (
          <button
            key={idx}
            onClick={() => onSelect?.(item.question)}
            disabled={disabled}
            className="text-left px-4 py-2.5 border border-white/8 text-sm text-white/55 font-mono
                       bg-black/15 hover:border-amber-500/30 hover:text-amber-300/80
                       hover:bg-amber-500/4 transition-all duration-150
                       disabled:opacity-20 disabled:cursor-not-allowed tracking-wide"
          >
            <span className="text-amber-400/40 mr-2 text-[10px]">▸</span>
            {item.question}
          </button>
        ))}
      </div>
    </div>
  )
}
