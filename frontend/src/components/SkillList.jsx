// ----------------
// SkillList.jsx
// config.json から読み込んだスキル一覧を表示。
// LLMが選択したスキルをハイライト。
// grab_cube のみ実装済み、他は "(例)" タグを表示。
// 計画中スキルは "(実装予定)" タグで暗示表示。
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
    description: 'お茶のペットボトルを取る',
    icon: '🍵',
    planned: true,
  },
]

export default function SkillList({ skills, selectedSkillId }) {
  if (!skills.length) return null

  // grab_cube の直後に計画中スキルを挿入して表示順を整える
  const firstSkill = skills.slice(0, 1)
  const restSkills = skills.slice(1)
  const allSkills = [...firstSkill, ...PLANNED_SKILLS, ...restSkills]

  return (
    <div className="glass p-5 space-y-3">
      <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest">
        Skill Set
      </h2>

      <div className="space-y-2">
        {allSkills.map(skill => {
          const isSelected    = skill.id === selectedSkillId
          const isImplemented = skill.id === 'grab_cube'  // 実際に動作するスキル
          const isPlanned     = skill.planned === true     // 実装予定のみ表示

          return (
            <div
              key={skill.id}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300
                ${isSelected
                  ? 'bg-blue-500/20 border-blue-400/50 shadow-lg shadow-blue-500/10'
                  : isPlanned
                    ? 'bg-white/2 border-white/5 opacity-45'
                    : 'bg-white/3 border-white/5 hover:bg-white/6'
                }
              `}
            >
              <span className="text-xl">{skill.icon ?? '🤖'}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isSelected ? 'text-blue-300' : 'text-white/70'}`}>
                  {skill.name}
                </p>
                <p className="text-xs text-white/35 truncate">{skill.description}</p>
              </div>

              {/* バッジ: Selected > 実装予定 > 例（実装済みは何も表示しない） */}
              <div className="flex items-center gap-1 shrink-0">
                {isSelected && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-300 border border-blue-400/30">
                    Selected
                  </span>
                )}
                {isPlanned && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/8 text-white/35 border border-white/10">
                    実装予定
                  </span>
                )}
                {!isImplemented && !isPlanned && !isSelected && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/8">
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
