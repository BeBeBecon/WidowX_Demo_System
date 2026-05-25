// ----------------
// SkillList.jsx
// config.json から読み込んだスキル一覧を表示。
// LLMが選択したスキルをアンバーハイライト。
// grab_cube のみ実装済み、他は "(例)" タグを表示。
// 計画中スキルは半透明で "(実装予定)" タグ。
// planned 以外のカードはクリックで CommandInput に task_name を送る。
// ----------------

// デモ展示用の計画中スキル（grab_cube の直後に挿入、バックエンドには送らない）
const PLANNED_SKILLS = [
  {
    id: 'wave_hand',
    name: 'Wave hand',
    description: '手を振る',
    icon: '👋',
    planned: true,
  },
  {
    id: 'pick_tea',
    name: 'Pick the bottle of tea',
    description: 'お茶のペットボトルを運ぶ',
    icon: '🍵',
    planned: true,
  },
]

export default function SkillList({ skills, selectedSkillId, onSelect }) {
  if (!skills.length) return null

  // grab_cube の直後に計画中スキルを挿入
  const firstSkill = skills.slice(0, 1)
  const restSkills = skills.slice(1)
  const allSkills = [...firstSkill, ...PLANNED_SKILLS, ...restSkills]

  return (
    <div className="glass p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-px h-4 bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
        <h2 className="panel-label">Skill Set</h2>
        <span className="ml-auto text-[10px] text-white/30 tracking-widest font-mono">
          {skills.filter(s => s).length} LOADED
        </span>
      </div>

      <div className="space-y-1.5">
        {allSkills.map((skill, idx) => {
          const isSelected    = skill.id === selectedSkillId
          const isImplemented = skill.id === 'grab_cube'
          const isPlanned     = skill.planned === true
          const isClickable   = !isPlanned && onSelect

          return (
            <div
              key={skill.id}
              onClick={() => isClickable && onSelect(skill.task_name ?? skill.name)}
              className={`
                relative flex items-center gap-3 px-4 py-3.5 border transition-all duration-300
                ${isClickable ? 'cursor-pointer' : 'cursor-default'}
                ${isSelected
                  ? 'bg-amber-500/8 border-amber-400/50 shadow-[0_0_18px_rgba(245,158,11,0.08)]'
                  : isPlanned
                    ? 'bg-black/20 border-white/4 opacity-40'
                    : 'bg-black/20 border-white/6 hover:border-amber-500/20 hover:bg-amber-500/4'
                }
              `}
            >
              {/* 左アクセントバー（選択時のみ表示） */}
              {isSelected && (
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.7)]" />
              )}

              {/* 番号 */}
              <span className="text-[10px] text-white/25 w-4 shrink-0 font-mono">
                {String(idx + 1).padStart(2, '0')}
              </span>

              <span className="text-lg shrink-0">{skill.icon ?? '🤖'}</span>

              <div className="flex-1 min-w-0">
                <p className={`text-base font-semibold truncate tracking-wide font-mono ${
                  isSelected ? 'text-amber-100' : isPlanned ? 'text-white/40' : 'text-white/80'
                }`}>
                  {skill.name}
                </p>
                <p className="text-xs text-white/35 truncate mt-0.5">{skill.description}</p>
              </div>

              {/* バッジ */}
              <div className="flex items-center gap-1 shrink-0">
                {isSelected && (
                  <span className="text-[9px] px-2 py-0.5 border border-amber-400/45 text-amber-300 tracking-widest uppercase bg-amber-500/8 font-mono">
                    Active
                  </span>
                )}
                {isPlanned && (
                  <span className="text-[9px] px-2 py-0.5 border border-white/10 text-white/25 tracking-widest uppercase font-mono">
                    Planned
                  </span>
                )}
                {!isImplemented && !isPlanned && !isSelected && (
                  <span className="text-[9px] px-2 py-0.5 border border-white/10 text-white/25 tracking-widest uppercase font-mono">
                    例
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
