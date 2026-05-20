// ----------------
// SkillList.jsx
// config.json から読み込んだスキル一覧を表示。
// LLMが選択したスキルをネオンハイライト。
// grab_cube のみ実装済み、他は "(例)" タグを表示。
// 計画中スキルは半透明で "(実装予定)" タグ。
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

export default function SkillList({ skills, selectedSkillId }) {
  if (!skills.length) return null

  // grab_cube の直後に計画中スキルを挿入
  const firstSkill = skills.slice(0, 1)
  const restSkills = skills.slice(1)
  const allSkills = [...firstSkill, ...PLANNED_SKILLS, ...restSkills]

  return (
    <div className="glass p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-px h-4 bg-cyan-400 shadow-[0_0_6px_rgba(0,229,255,0.8)]" />
        <h2 className="panel-label">Skill Set</h2>
        <span className="ml-auto text-[10px] text-cyan-500/30 tracking-widest">
          {skills.filter(s => s).length} LOADED
        </span>
      </div>

      <div className="space-y-1.5">
        {allSkills.map((skill, idx) => {
          const isSelected    = skill.id === selectedSkillId
          const isImplemented = skill.id === 'grab_cube'
          const isPlanned     = skill.planned === true

          return (
            <div
              key={skill.id}
              className={`
                relative flex items-center gap-3 px-4 py-3.5 border transition-all duration-300
                ${isSelected
                  ? 'bg-cyan-500/10 border-cyan-400/60 shadow-[0_0_20px_rgba(0,229,255,0.12)]'
                  : isPlanned
                    ? 'bg-black/20 border-white/5 opacity-40'
                    : 'bg-black/30 border-cyan-500/10 hover:border-cyan-500/25 hover:bg-cyan-500/5'
                }
              `}
            >
              {/* 左アクセントバー（選択時のみ表示） */}
              {isSelected && (
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-cyan-400 shadow-[0_0_8px_rgba(0,229,255,0.9)]" />
              )}

              {/* 番号 */}
              <span className="text-[10px] text-cyan-500/30 w-4 shrink-0 font-mono">
                {String(idx + 1).padStart(2, '0')}
              </span>

              <span className="text-lg shrink-0">{skill.icon ?? '🤖'}</span>

              <div className="flex-1 min-w-0">
                <p className={`text-base font-semibold truncate tracking-wide ${
                  isSelected ? 'text-cyan-200' : isPlanned ? 'text-white/40' : 'text-white/70'
                }`}>
                  {skill.name}
                </p>
                <p className="text-xs text-cyan-500/30 truncate mt-0.5">{skill.description}</p>
              </div>

              {/* バッジ */}
              <div className="flex items-center gap-1 shrink-0">
                {isSelected && (
                  <span className="text-[9px] px-2 py-0.5 border border-cyan-400/50 text-cyan-300 tracking-widest uppercase bg-cyan-500/10">
                    Active
                  </span>
                )}
                {isPlanned && (
                  <span className="text-[9px] px-2 py-0.5 border border-white/10 text-white/25 tracking-widest uppercase">
                    Planned
                  </span>
                )}
                {!isImplemented && !isPlanned && !isSelected && (
                  <span className="text-[9px] px-2 py-0.5 border border-cyan-500/15 text-cyan-500/30 tracking-widest uppercase">
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
