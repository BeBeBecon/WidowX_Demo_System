// ----------------
// SkillList.jsx
// config.json から読み込んだスキル一覧を大型カードで表示。
// LLMが選択したスキルをアンバーハイライト。
// パネル上部のユーザー位置プルダウン（globalDirection）で direction_aware スキルの向きを一括指定。
// command_templates + command_verb から日本語コマンドテキストを生成して CommandInput へ送る。
// ----------------

// 方向選択肢: None = OpenCV値またはスキルの default_direction に委ねる
const DIRECTION_OPTIONS = [
  { value: null,     label: 'None' },
  { value: 'left',   label: '◀ Left' },
  { value: 'center', label: '● Center' },
  { value: 'right',  label: '▶ Right' },
]

export default function SkillList({ skills, selectedSkillId, onSelect, globalDirection, onDirectionChange, commandTemplates }) {
  // 有効な方向を取得（globalDirection > skill.default_direction > center）
  const getDir = (skill) =>
    globalDirection ?? skill.default_direction ?? 'center'

  // ----------------
  // カードクリック時のコマンドテキスト生成
  // direction_aware: command_templates + command_verb を使って日本語テキスト生成
  // 通常スキル: command_verb または skill.name を送信
  // ----------------
  const handleCardClick = (skill) => {
    if (!skill.direction_aware) {
      onSelect?.(skill.command_verb ?? skill.name)
      return
    }
    const dir  = getDir(skill)
    const verb = skill.command_verb ?? skill.name
    const tmpl = commandTemplates?.[dir]
    const text = tmpl
      ? tmpl.replace('{name}', verb)
      : `${verb}（${dir}方向）`
    onSelect?.(text)
  }

  if (!skills.length) return null

  return (
    <div className="glass p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-px h-4 bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
        <h2 className="panel-label">Skill Set</h2>
        <span className="ml-auto text-[10px] text-white/30 tracking-widest font-mono">
          {skills.length} LOADED
        </span>
      </div>

      {/* ユーザー位置プルダウン: direction_aware スキルの向きを一括指定 */}
      <div className="flex items-center gap-2 pb-1 border-b border-white/5">
        <span className="text-[10px] text-white/35 tracking-widest font-mono uppercase shrink-0">
          ユーザー位置
        </span>
        <select
          value={globalDirection ?? ''}
          onChange={e => onDirectionChange?.(e.target.value || null)}
          className="flex-1 bg-black/30 border border-white/10 text-xs text-white/55 font-mono
                     px-2 py-1.5 rounded-none appearance-none cursor-pointer
                     focus:outline-none focus:border-sky-500/40 focus:text-sky-300
                     hover:border-sky-500/30 hover:text-sky-300/80
                     transition-all duration-150"
        >
          {DIRECTION_OPTIONS.map(opt => (
            <option key={String(opt.value)} value={opt.value ?? ''}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        {skills.map((skill, idx) => {
          const isSelected       = skill.id === selectedSkillId
          const isDirectionAware = skill.direction_aware === true
          const isReplay         = skill.skill_type === 'replay'

          return (
            <div
              key={skill.id}
              onClick={() => handleCardClick(skill)}
              className={`
                relative flex items-center gap-3 px-3 py-2.5 border transition-all duration-300 cursor-pointer
                ${isSelected
                  ? 'bg-amber-500/8 border-amber-400/50 shadow-[0_0_18px_rgba(245,158,11,0.08)]'
                  : 'bg-black/20 border-white/6 hover:border-amber-500/20 hover:bg-amber-500/4'
                }
              `}
            >
              {/* 左アクセントバー（選択時のみ） */}
              {isSelected && (
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.7)]" />
              )}

              {/* 番号 */}
              <span className="text-[10px] text-white/25 w-4 shrink-0 font-mono">
                {String(idx + 1).padStart(2, '0')}
              </span>

              {/* アイコン */}
              <span className="text-xl shrink-0">{skill.icon ?? '🤖'}</span>

              {/* 名前・説明 */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate tracking-wide font-mono ${
                  isSelected ? 'text-amber-100' : 'text-white/85'
                }`}>
                  {skill.name}
                </p>
                <p className="text-[11px] text-white/35 truncate">{skill.description}</p>
              </div>

              {/* バッジ群 */}
              <div className="flex items-center gap-1 shrink-0">
                {isSelected && (
                  <span className="text-[9px] px-1.5 py-0.5 border border-amber-400/45 text-amber-300 tracking-widest uppercase bg-amber-500/8 font-mono">
                    Active
                  </span>
                )}
                <span className={`text-[9px] px-1.5 py-0.5 border tracking-widest uppercase font-mono ${
                  isReplay
                    ? 'border-teal-500/35 text-teal-400/70'
                    : 'border-violet-500/35 text-violet-400/70'
                }`}>
                  {isReplay ? 'Replay' : 'ACT'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
