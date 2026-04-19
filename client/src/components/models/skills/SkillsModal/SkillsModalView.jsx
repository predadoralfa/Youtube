import "@/style/researchModal.css";
import "@/style/skillsModal.css";

const SKILL_ORDER = ["SKILL_CRAFTING", "SKILL_BUILDING", "SKILL_COOKING", "SKILL_GATHERING"];
const SKILL_ACCENTS = {
  SKILL_CRAFTING: "craft",
  SKILL_BUILDING: "build",
  SKILL_COOKING: "cook",
  SKILL_GATHERING: "gather",
};

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "0");
  return new Intl.NumberFormat("en-US").format(n);
}

function formatXpPair(currentXp, requiredXp) {
  return `${formatNumber(currentXp)} / ${formatNumber(requiredXp)} XP`;
}

function getSkillInitials(skillName) {
  const parts = String(skillName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "SK";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function normalizeSkills(snapshot) {
  const raw = snapshot ?? {};
  const list = Array.isArray(raw) ? raw : Object.values(raw);
  const order = new Map(SKILL_ORDER.map((code, index) => [code, index]));

  return list
    .filter(Boolean)
    .map((skill) => {
      const skillCode = String(skill?.skillCode ?? skill?.code ?? "").trim().toUpperCase();
      const currentLevel = Math.max(1, toNumber(skill?.currentLevel ?? skill?.current_level ?? 1, 1));
      const currentXp = String(skill?.currentXp ?? skill?.current_xp ?? "0");
      const totalXp = String(skill?.totalXp ?? skill?.total_xp ?? "0");
      const requiredXp = String(skill?.requiredXp ?? skill?.required_xp ?? "100");
      const maxLevel = Math.max(1, toNumber(skill?.maxLevel ?? skill?.max_level ?? 1, 1));
      const sortIndex = order.has(skillCode) ? order.get(skillCode) : SKILL_ORDER.length + 1;

      return {
        ...skill,
        skillCode,
        skillName: skill?.skillName ?? skill?.name ?? skillCode ?? "Skill",
        currentLevel,
        currentXp,
        totalXp,
        requiredXp,
        maxLevel,
        sortIndex,
        accent: SKILL_ACCENTS[skillCode] ?? "neutral",
        progressPct: Math.min(
          100,
          Math.max(0, (toNumber(currentXp, 0) / Math.max(1, toNumber(requiredXp, 1))) * 100)
        ),
      };
    })
    .sort((a, b) => {
      if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex;
      return String(a.skillName).localeCompare(String(b.skillName));
    });
}

function SkillCard({ skill }) {
  const title = String(skill?.skillName ?? skill?.skillCode ?? "Skill");
  const level = Math.max(1, toNumber(skill?.currentLevel ?? 1, 1));
  const currentXp = String(skill?.currentXp ?? "0");
  const requiredXp = String(skill?.requiredXp ?? "100");
  const totalXp = String(skill?.totalXp ?? "0");
  const maxLevel = Math.max(1, toNumber(skill?.maxLevel ?? 1, 1));
  const initials = getSkillInitials(title);

  return (
    <article className={`skills-card skills-card--${skill?.accent ?? "neutral"}`}>
      <div className="skills-card-head">
        <div className="skills-icon-box" aria-hidden="true">
          <span className="skills-icon-label">{initials}</span>
        </div>
        <div className="skills-head-copy">
          <h3>{title}</h3>
        </div>
      </div>

      <div className="skills-meta">
        <span>Level {level}</span>
        <strong>{formatXpPair(currentXp, requiredXp)}</strong>
      </div>

      <div className="skills-meter" aria-hidden="true">
        <span style={{ width: `${skill?.progressPct ?? 0}%` }} />
      </div>

      <div className="skills-submeta">
        <span>Total XP {formatNumber(totalXp)}</span>
      </div>
    </article>
  );
}

export function SkillsModal({ open, snapshot, onClose }) {
  if (!open) return null;

  const skills = normalizeSkills(snapshot);

  return (
    <div
      className="research-overlay skills-overlay"
      data-ui-block-game-input="true"
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="research-modal skills-modal" onContextMenu={(e) => e.preventDefault()}>
        <div className="research-shell skills-shell">
          <div className="research-topbar skills-topbar">
            <div className="research-topbar-main">
              <div className="research-topbar-copy">
                <p className="research-kicker">Skills</p>
                <h2>Profession Skills</h2>
                <p className="research-copy">
                  Track the character&apos;s profession levels and experience in one place.
                </p>
              </div>

              <div className="skills-summary">
                <span className="skills-summary-label">Loaded</span>
                <strong>{skills.length} skills</strong>
              </div>
            </div>

            <button type="button" className="research-close skills-close" onClick={onClose}>
              Close
            </button>
          </div>

          <div className="research-board skills-board">
            <div className="skills-grid">
              {skills.length ? (
                skills.map((skill) => <SkillCard key={skill?.skillCode ?? skill?.skillName} skill={skill} />)
              ) : (
                <div className="skills-empty">
                  <h3>Skill data unavailable</h3>
                  <p>The profession snapshot has not loaded yet.</p>
                </div>
              )}
            </div>
          </div>

          <div className="research-footer">
            <span>Shortcut: G</span>
            <span>Close: Esc</span>
          </div>
        </div>
      </div>
    </div>
  );
}
