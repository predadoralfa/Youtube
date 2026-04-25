import { useEffect, useMemo, useState } from "react";

import { resolvePrimitiveShelterBuildRequirements } from "@/world/build/requirements";

const SKILL_ORDER = ["SKILL_CRAFTING", "SKILL_BUILDING", "SKILL_COOKING", "SKILL_GATHERING"];
const DEFAULT_GATHERING_COOLDOWN_MS = 4000;

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function resolveStatusBarTone(current, max) {
  const safeMax = Math.max(1, Number(max ?? 1));
  const ratio = clamp01(Number(current ?? 0) / safeMax);

  if (ratio < 0.05) {
    return {
      labelTone: "critical",
      fill: "linear-gradient(90deg, rgba(220,38,38,0.98), rgba(239,68,68,0.92))",
      border: "rgba(239, 68, 68, 0.32)",
      pulse: true,
      pulseColor: "rgba(239, 68, 68, 0.95)",
    };
  }

  if (ratio < 0.15) {
    return {
      labelTone: "danger",
      fill: "linear-gradient(90deg, rgba(244,63,94,0.96), rgba(251,146,60,0.92))",
      border: "rgba(244, 63, 94, 0.28)",
      pulse: false,
      pulseColor: "rgba(244, 63, 94, 0.75)",
    };
  }

  if (ratio < 0.3) {
    return {
      labelTone: "warning",
      fill: "linear-gradient(90deg, rgba(251,191,36,0.96), rgba(249,115,22,0.9))",
      border: "rgba(251, 191, 36, 0.26)",
      pulse: false,
      pulseColor: "rgba(251, 191, 36, 0.72)",
    };
  }

  return {
    labelTone: "normal",
    fill: "linear-gradient(90deg, rgba(56,189,248,0.95), rgba(34,197,94,0.9))",
    border: "rgba(56, 189, 248, 0.24)",
    pulse: false,
    pulseColor: "rgba(56, 189, 248, 0.72)",
  };
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(Number(ms ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return seconds > 0 ? `${minutes}m ${String(seconds).padStart(2, "0")}s` : `${minutes}m`;
}

function resolveActiveResearch(researchSnapshot, nowMs) {
  const studies = Array.isArray(researchSnapshot?.studies) ? researchSnapshot.studies : [];
  const activeCode = researchSnapshot?.activeResearchCode ?? null;
  const active =
    studies.find((study) => String(study?.code ?? "") === String(activeCode ?? "")) ??
    studies.find((study) => study?.isRunning) ??
    null;

  if (!active) return null;

  const serverNowMs = Number(researchSnapshot?.serverNowMs ?? nowMs);
  const elapsedSinceSnapshot = Math.max(0, nowMs - serverNowMs);
  const totalMs = Math.max(0, Number(active.levelStudyTimeMs ?? 0));
  const progressMs = Math.min(totalMs, Math.max(0, Number(active.progressMs ?? 0) + elapsedSinceSnapshot));
  const remainingMs = Math.max(0, totalMs - progressMs);

  return {
    title: active.name || active.code || "Research",
    subtitle: active.levelTitle || active.nextLevelTitle || `Level ${active.activeLevel ?? 1}`,
    progressRatio: totalMs > 0 ? clamp01(progressMs / totalMs) : 0,
    remainingText: formatDuration(remainingMs),
  };
}

function resolveCraftJobs(inventorySnapshot, nowMs) {
  const jobs =
    inventorySnapshot?.craft?.activeJobs ??
    inventorySnapshot?.craft?.jobs ??
    inventorySnapshot?.craftJobs ??
    [];

  if (!Array.isArray(jobs)) return [];

  return jobs
    .filter((job) => ["RUNNING", "COMPLETED"].includes(String(job?.status ?? "").toUpperCase()))
    .map((job) => {
      const startedAtMs = Number(job.startedAtMs ?? job.started_at_ms ?? nowMs);
      const totalMs = Math.max(0, Number(job.craftTimeMs ?? job.craft_time_ms ?? 0));
      const savedProgressMs = Math.max(0, Number(job.progressMs ?? job.current_progress_ms ?? 0));
      const elapsedSinceStart = Math.max(0, nowMs - startedAtMs);
      const isComplete = String(job?.status ?? "").toUpperCase() === "COMPLETED";
      const progressMs = isComplete ? totalMs : Math.min(totalMs, Math.max(savedProgressMs, elapsedSinceStart));

      return {
        id: String(job.id ?? job.code ?? job.craftCode ?? Math.random()),
        title: job.name || job.craftName || job.craftCode || "Craft",
        subtitle: isComplete ? "Ready to take" : "Hand craft",
        progressRatio: totalMs > 0 ? clamp01(progressMs / totalMs) : 0,
        remainingText: isComplete ? "Ready" : formatDuration(Math.max(0, totalMs - progressMs)),
      };
    });
}

function resolveActiveBuild(snapshot, inventorySnapshot, equipmentSnapshot, nowMs) {
  const actors = Array.isArray(snapshot?.actors) ? snapshot.actors : [];
  const userId = String(snapshot?.runtime?.userId ?? snapshot?.runtime?.user_id ?? "");
  const active = actors.find((actor) => {
    const state = actor?.state ?? null;
    const kind = String(state?.buildKind ?? actor?.actorType ?? actor?.actorDefCode ?? "").toUpperCase();
    if (kind !== "PRIMITIVE_SHELTER") return false;
    const ownerId = String(state?.ownerUserId ?? state?.owner_user_id ?? "");
    if (userId && ownerId && ownerId !== userId) return false;
    return ["PLANNED", "RUNNING", "PAUSED"].includes(String(state?.constructionState ?? "").toUpperCase());
  });

  if (!active) return null;

  const state = active.state ?? {};
  const constructionState = String(state.constructionState ?? "PLANNED").toUpperCase();
  const durationMs = Math.max(0, Number(state.constructionDurationMs ?? 0));
  const startedAtMs = Number(state.constructionStartedAtMs ?? 0);
  const progressMs =
    constructionState === "RUNNING" && startedAtMs > 0
      ? Math.min(durationMs, Math.max(0, nowMs - startedAtMs))
      : Math.max(0, Number(state.constructionProgressMs ?? 0));
  const progressRatio = durationMs > 0 ? clamp01(progressMs / durationMs) : 0;
  const buildState = resolvePrimitiveShelterBuildRequirements(state, {
    inventory: inventorySnapshot,
    equipment: equipmentSnapshot,
  });

  return {
    actorId: String(active.id ?? ""),
    title: String(state.displayName ?? state.structureName ?? active.displayName ?? "Primitive Shelter"),
    subtitle:
      constructionState === "RUNNING"
        ? "Building"
        : constructionState === "PAUSED"
          ? "Paused"
          : "Planning",
    remainingText: formatDuration(Math.max(0, durationMs - progressMs)),
    progressRatio,
    progressText: `${Math.round(progressRatio * 100)}%`,
    constructionState,
    canCancel: ["PLANNED", "RUNNING", "PAUSED"].includes(constructionState),
    canPause: constructionState === "RUNNING",
    canResume: constructionState === "PAUSED",
    buildState,
  };
}

function resolveActiveSleep(snapshot) {
  const sleepLock = snapshot?.runtime?.sleepLock ?? null;
  if (!sleepLock?.active && !sleepLock?.pending) return null;

  return {
    pending: Boolean(sleepLock?.pending),
    title: "Sleep",
    subtitle: sleepLock?.pending ? "Approaching shelter" : "Sleeping",
    remainingText: sleepLock?.pending ? "Cancel with ESC" : "Wake with ESC",
  };
}

function resolveSleepXpMultiplierBasisPoints(sleepCurrent, sleepMax = 100) {
  const max = Math.max(1, Number(sleepMax ?? 100));
  const current = Math.min(max, Math.max(0, Number(sleepCurrent ?? 100)));
  const sleepPercent = Math.min(100, Math.max(0, (current / max) * 100));

  if (sleepPercent >= 30) {
    const bonusRatio = (sleepPercent - 30) / 70;
    return Math.round(10000 + bonusRatio * 2000);
  }

  const penaltyRatio = (30 - sleepPercent) / 30;
  return Math.round(10000 - penaltyRatio * 1000);
}

function resolveStatusSnapshot(snapshot) {
  const status = snapshot?.runtime?.status ?? snapshot?.status ?? null;
  const immunityCurrentRaw = Number(status?.immunity?.current ?? snapshot?.runtime?.immunityCurrent ?? 100);
  const immunityMaxRaw = Number(status?.immunity?.max ?? snapshot?.runtime?.immunityMax ?? 100);
  const immunityPercentRaw = Number(
    status?.immunity?.percent ?? snapshot?.runtime?.immunityPercent ?? snapshot?.runtime?.status?.immunity?.percent ?? 0
  );
  const immunityCurrent = Math.max(0, Number.isFinite(immunityCurrentRaw) ? immunityCurrentRaw : 100);
  const immunityMax = Math.max(1, Number.isFinite(immunityMaxRaw) ? immunityMaxRaw : 100);
  const hungerCurrent = Number(
    status?.hunger?.current ??
      snapshot?.runtime?.hungerCurrent ??
      snapshot?.runtime?.vitals?.hunger?.current ??
      snapshot?.vitals?.hunger?.current ??
      100
  );
  const hungerMax = Math.max(
    1,
    Number(
      status?.hunger?.max ??
        snapshot?.runtime?.hungerMax ??
        snapshot?.runtime?.vitals?.hunger?.max ??
        snapshot?.vitals?.hunger?.max ??
        100
    )
  );
  const thirstCurrent = Number(
    status?.thirst?.current ??
      snapshot?.runtime?.thirstCurrent ??
      snapshot?.runtime?.vitals?.thirst?.current ??
      snapshot?.vitals?.thirst?.current ??
      100
  );
  const thirstMax = Math.max(
    1,
    Number(
      status?.thirst?.max ??
        snapshot?.runtime?.thirstMax ??
        snapshot?.runtime?.vitals?.thirst?.max ??
        snapshot?.vitals?.thirst?.max ??
        100
    )
  );
  const feverCurrent = Number(status?.fever?.current ?? snapshot?.runtime?.feverCurrent ?? 0);
  const feverMax = Number(status?.fever?.max ?? snapshot?.runtime?.feverMax ?? 100);
  const feverPercent = Number(
    status?.fever?.percent ?? snapshot?.runtime?.feverPercent ?? snapshot?.runtime?.status?.fever?.percent ?? 0
  );
  const feverActive = Boolean(status?.fever?.active ?? snapshot?.runtime?.feverActive ?? false);
  const sleepCurrent = Number(status?.sleep?.current ?? snapshot?.runtime?.sleepCurrent ?? 100);
  const sleepMax = Math.max(1, Number(status?.sleep?.max ?? snapshot?.runtime?.sleepMax ?? 100));
  const sleepMultiplierBps = resolveSleepXpMultiplierBasisPoints(sleepCurrent, sleepMax);
  const sleepMultiplier = sleepMultiplierBps / 10000;

  return {
    hasStatus: Boolean(status),
    hungerCurrent,
    hungerMax,
    hungerPercent: Math.round((hungerCurrent / hungerMax) * 100),
    thirstCurrent,
    thirstMax,
    thirstPercent: Math.round((thirstCurrent / thirstMax) * 100),
    immunityCurrent,
    immunityMax,
    immunityPercent: Number.isFinite(immunityPercentRaw) ? immunityPercentRaw : 0,
    feverCurrent,
    feverMax,
    feverPercent: Number.isFinite(feverPercent) ? feverPercent : 0,
    feverActive,
    sleepCurrent,
    sleepMax,
    sleepMultiplier,
    sleepMultiplierBps,
  };
}

function normalizeSkillLabel(skillName, skillCode) {
  const raw = String(skillName ?? "").trim();
  if (raw) return raw;
  const code = String(skillCode ?? "").trim().toUpperCase();
  if (!code) return "Skill";
  return code.replace(/^SKILL_/, "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatXpRemaining(currentXp, requiredXp) {
  const current = Math.max(0, Number(currentXp ?? 0));
  const required = Math.max(0, Number(requiredXp ?? 0));
  if (!Number.isFinite(required) || required <= 0) return "MAX";
  const remaining = Math.max(0, required - current);
  return `${Math.round(remaining)} XP to next`;
}

function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0%";
  return `${Math.round(n)}%`;
}

function resolveSkillBonusText(skillCode, currentLevel, maxLevel) {
  const code = String(skillCode ?? "").toUpperCase();
  const level = Math.max(1, Number(currentLevel ?? 1));
  const safeMaxLevel = Math.max(1, Number(maxLevel ?? 1));

  if (code === "SKILL_CRAFTING") {
    const reducedSeconds = Math.max(0, (level - 1) * 30);
    return reducedSeconds > 0 ? `-${reducedSeconds}s craft time` : "Base craft speed";
  }

  if (code === "SKILL_GATHERING") {
    const baseCooldownMs = DEFAULT_GATHERING_COOLDOWN_MS;
    const reductionPerLevelMs = Math.max(0, (baseCooldownMs - 30) / safeMaxLevel);
    const reducedCooldownMs = Math.max(30, Math.round(baseCooldownMs - reductionPerLevelMs * level));
    const bonusPercent = ((baseCooldownMs - reducedCooldownMs) / baseCooldownMs) * 100;
    return `-${formatPercent(bonusPercent)} gather cooldown`;
  }

  if (code === "SKILL_BUILDING") {
    const reducedMs = level * 30000;
    return `-${formatDuration(reducedMs)} build time`;
  }

  if (code === "SKILL_COOKING") {
    return level > 1 ? "No passive bonus yet" : "Base level";
  }

  return "No passive bonus yet";
}

function resolveSkillStatusList(rawSkills) {
  const list = Array.isArray(rawSkills) ? rawSkills : Object.values(rawSkills ?? {});
  const order = new Map(SKILL_ORDER.map((code, index) => [code, index]));

  return list
    .filter(Boolean)
    .map((skill) => {
      const skillCode = String(skill?.skillCode ?? skill?.code ?? "").trim().toUpperCase();
      const currentLevel = Math.max(1, Number(skill?.currentLevel ?? skill?.current_level ?? 1));
      const currentXp = Number(skill?.currentXp ?? skill?.current_xp ?? 0);
      const requiredXp = Number(skill?.requiredXp ?? skill?.required_xp ?? 0);
      const maxLevel = Math.max(1, Number(skill?.maxLevel ?? skill?.max_level ?? 1));

      return {
        skillCode,
        skillName: normalizeSkillLabel(skill?.skillName ?? skill?.name ?? null, skillCode),
        currentLevel,
        currentXp,
        requiredXp,
        maxLevel,
        progressPercent:
          requiredXp > 0 ? Math.max(0, Math.min(100, (currentXp / requiredXp) * 100)) : 100,
        bonusText: resolveSkillBonusText(skillCode, currentLevel, maxLevel),
        remainingText:
          currentLevel >= maxLevel
            ? "MAX"
            : formatXpRemaining(currentXp, requiredXp),
        sortIndex: order.has(skillCode) ? order.get(skillCode) : SKILL_ORDER.length + 1,
      };
    })
    .sort((a, b) => {
      if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex;
      return String(a.skillName).localeCompare(String(b.skillName));
    });
}

function MiniVitalRow({
  label,
  current,
  max,
  color,
  trackColor = "rgba(15, 23, 42, 0.92)",
  percentText = null,
  radius = 4,
  trackBorderColor = "rgba(59, 130, 246, 0.24)",
  pulse = false,
  pulseColor = "rgba(239, 68, 68, 0.9)",
}) {
  const safeCurrent = Math.max(0, Number(current ?? 0));
  const safeMax = Math.max(1, Number(max ?? 1));
  const ratio = clamp01(safeCurrent / safeMax);
  const percentLabel = Math.round(ratio * 100);

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "baseline",
        }}
      >
        <span
          style={{
            color: "rgba(191, 219, 254, 0.86)",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.11em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        <span style={{ color: "rgba(248, 250, 252, 0.82)", fontSize: 11 }}>
          {percentText ?? `${percentLabel}%`}
        </span>
      </div>

      <div
        style={{
          height: 12,
          overflow: "hidden",
          border: `1px solid ${trackBorderColor}`,
          borderRadius: radius,
          background: trackColor,
          boxShadow: pulse ? `0 0 0 1px ${pulseColor}, 0 0 12px ${pulseColor}` : "none",
          animation: pulse ? "statusCriticalPulse 1.25s ease-in-out infinite" : "none",
        }}
      >
        <div
          style={{
            width: `${Math.round(ratio * 100)}%`,
            height: "100%",
            borderRadius: radius,
            background: color,
            transition: "width 240ms ease",
          }}
        />
      </div>
    </div>
  );
}

function JobRow({
  label,
  title,
  subtitle,
  remainingText,
  progressRatio,
  progressPercent,
  emptyText,
  extra = null,
  hideTitle = false,
  hideRemaining = false,
  pulse = false,
  pulseColor = "rgba(239, 68, 68, 0.9)",
}) {
  const hasJob = Boolean(title);

  return (
    <div style={{ display: "grid", gap: 7 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "baseline",
        }}
      >
        <span
          style={{
            color: "rgba(191, 219, 254, 0.86)",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.11em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        {!hideRemaining ? (
          <span style={{ color: "rgba(248, 250, 252, 0.82)", fontSize: 11 }}>
            {hasJob ? remainingText : "idle"}
          </span>
        ) : null}
      </div>

      {!hideTitle ? (
        <div style={{ color: "#f8fafc", fontSize: 13, fontWeight: 700, lineHeight: 1.15 }}>
          {hasJob ? title : emptyText}
        </div>
      ) : null}

      {hasJob && subtitle ? (
        <div style={{ color: "rgba(226, 232, 240, 0.68)", fontSize: 11, lineHeight: 1.25 }}>
          {subtitle}
        </div>
      ) : null}

      <div
        style={{
          height: 12,
          overflow: "hidden",
          border: "1px solid rgba(56, 189, 248, 0.24)",
          borderRadius: 4,
          background: "rgba(5, 10, 18, 0.72)",
          boxShadow: pulse ? `0 0 0 1px ${pulseColor}, 0 0 12px ${pulseColor}` : "none",
          animation: pulse ? "statusCriticalPulse 1.25s ease-in-out infinite" : "none",
        }}
      >
        <div
          style={{
            width: `${Math.round(clamp01(progressPercent != null ? Number(progressPercent) / 100 : progressRatio) * 100)}%`,
            height: "100%",
            borderRadius: 4,
            background: hasJob
              ? "linear-gradient(90deg, rgba(56,189,248,0.95), rgba(34,197,94,0.9))"
              : "rgba(148, 163, 184, 0.22)",
            transition: "width 240ms ease",
          }}
        />
      </div>

      {extra}
    </div>
  );
}

function SkillsStatusBlock({ skillsSnapshot }) {
  const skills = useMemo(() => resolveSkillStatusList(skillsSnapshot), [skillsSnapshot]);

  if (!skills.length) return null;

  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        marginBottom: 18,
        padding: 12,
        borderRadius: 14,
        border: "1px solid rgba(59, 130, 246, 0.18)",
        background: "linear-gradient(180deg, rgba(8, 15, 26, 0.94), rgba(5, 10, 18, 0.9))",
      }}
    >
      <div
        style={{
          fontSize: 12,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "rgba(191, 219, 254, 0.85)",
        }}
      >
        Skills
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {skills.map((skill) => (
          <div
            key={skill.skillCode || skill.skillName}
            style={{
              display: "grid",
              gap: 6,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(56, 189, 248, 0.14)",
              background: "rgba(5, 10, 18, 0.55)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <span
                style={{
                  color: "#f8fafc",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                }}
              >
                {skill.skillName}
              </span>
              <span style={{ color: "rgba(191, 219, 254, 0.82)", fontSize: 11 }}>
                Level {skill.currentLevel}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <span style={{ color: "rgba(226, 232, 240, 0.72)", fontSize: 11 }}>
                {skill.remainingText}
              </span>
              <span style={{ color: "rgba(248, 250, 252, 0.82)", fontSize: 11, fontWeight: 700 }}>
                {skill.bonusText}
              </span>
            </div>

              <div
                style={{
                  height: 8,
                  overflow: "hidden",
                  border: "1px solid rgba(56, 189, 248, 0.18)",
                  borderRadius: 3,
                  background: "rgba(5, 10, 18, 0.72)",
                }}
              >
                <div
                  style={{
                    width: `${skill.progressPercent}%`,
                    height: "100%",
                    borderRadius: 3,
                    background: "linear-gradient(90deg, rgba(56,189,248,0.95), rgba(34,197,94,0.9))",
                    transition: "width 240ms ease",
                  }}
                />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SleepOverlayCard({ sleepSummary, sleepCurrent, sleepMax, onStopSleep }) {
  if (!sleepSummary) return null;

  const safeCurrent = Math.max(0, Number(sleepCurrent ?? 0));
  const safeMax = Math.max(1, Number(sleepMax ?? 1));
  const ratio = clamp01(safeCurrent / safeMax);
  const progressPercent = ratio * 100;

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1130,
        width: "min(420px, calc(100vw - 32px))",
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          borderRadius: 16,
          padding: "14px 16px",
          border: "1px solid rgba(56, 189, 248, 0.35)",
          background: "linear-gradient(180deg, rgba(10, 16, 28, 0.96), rgba(5, 10, 18, 0.94))",
          boxShadow: "0 18px 40px rgba(0, 0, 0, 0.42)",
          color: "#f8fafc",
          backdropFilter: "blur(8px)",
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div
              style={{
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(191, 219, 254, 0.85)",
              }}
            >
              {sleepSummary.title}
            </div>
            <div style={{ color: "rgba(226, 232, 240, 0.76)", fontSize: 12 }}>
              {sleepSummary.subtitle}
            </div>
          </div>

          <div style={{ color: "rgba(226, 232, 240, 0.78)", fontSize: 12, fontWeight: 700 }}>
            {sleepSummary.remainingText}
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div
            style={{
              height: 14,
              overflow: "hidden",
              border: "1px solid rgba(56, 189, 248, 0.24)",
              borderRadius: 999,
              background: "rgba(5, 10, 18, 0.72)",
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                borderRadius: 999,
                background: "linear-gradient(90deg, rgba(56,189,248,0.95), rgba(34,197,94,0.9))",
                transition: "width 240ms ease",
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ color: "rgba(248, 250, 252, 0.82)", fontSize: 12 }}>
              {Math.round(safeCurrent)} / {Math.round(safeMax)} ({Math.round(progressPercent)}%)
            </div>

            {typeof onStopSleep === "function" ? (
              <button
                type="button"
                onClick={onStopSleep}
                style={{
                  borderRadius: 10,
                  border: "1px solid rgba(239, 68, 68, 0.45)",
                  background: "rgba(127, 29, 29, 0.32)",
                  color: "#fecaca",
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlayerStatusPanel({
  snapshot,
  researchSnapshot,
  inventorySnapshot,
  equipmentSnapshot,
  onCancelBuild = null,
  onPauseBuild = null,
  onResumeBuild = null,
  onStopSleep = null,
}) {
  const [open, setOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const activeResearch = useMemo(
    () => resolveActiveResearch(researchSnapshot, nowMs),
    [researchSnapshot, nowMs]
  );
  const craftJobs = useMemo(
    () => resolveCraftJobs(inventorySnapshot, nowMs),
    [inventorySnapshot, nowMs]
  );
  const activeCraft = craftJobs[0] ?? null;
  const activeBuild = useMemo(
    () => resolveActiveBuild(snapshot, inventorySnapshot, equipmentSnapshot, nowMs),
    [snapshot, inventorySnapshot, equipmentSnapshot, nowMs]
  );
  const activeSleep = useMemo(() => resolveActiveSleep(snapshot), [snapshot]);
  const [showCloseBar, setShowCloseBar] = useState(false);
  const statusSummary = useMemo(() => resolveStatusSnapshot(snapshot), [snapshot]);
  const skillsSnapshot = inventorySnapshot?.skills ?? snapshot?.inventory?.skills ?? snapshot?.skills ?? null;
  const hungerTone = resolveStatusBarTone(statusSummary.hungerCurrent, statusSummary.hungerMax);
  const thirstTone = resolveStatusBarTone(statusSummary.thirstCurrent, statusSummary.thirstMax);
  const sleepTone = resolveStatusBarTone(statusSummary.sleepCurrent, statusSummary.sleepMax);
  const immunityTone = resolveStatusBarTone(statusSummary.immunityCurrent, statusSummary.immunityMax);

  useEffect(() => {
    if (!open) {
      setShowCloseBar(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowCloseBar(true);
    }, 260);

    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <>
      <style>
        {`
          @keyframes statusCriticalPulse {
            0% {
              box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.55), 0 0 8px rgba(239, 68, 68, 0.22);
            }
            50% {
              box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.9), 0 0 16px rgba(239, 68, 68, 0.5);
            }
            100% {
              box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.55), 0 0 8px rgba(239, 68, 68, 0.22);
            }
          }
        `}
      </style>
      <SleepOverlayCard
        sleepSummary={activeSleep}
        sleepCurrent={statusSummary.sleepCurrent}
        sleepMax={statusSummary.sleepMax}
        onStopSleep={onStopSleep}
      />

      <div
        style={{
          position: "fixed",
          top: 74,
          right: 16,
          zIndex: 1100,
          width: open ? 270 : 28,
          pointerEvents: "none",
          display: "flex",
          justifyContent: "flex-end",
          transition: "width 0.32s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "stretch", pointerEvents: "auto" }}>
          <div
            style={{
              width: open ? (showCloseBar ? 22 : 0) : 28,
              minWidth: open ? (showCloseBar ? 22 : 0) : 28,
              borderRadius: 14,
              borderTopRightRadius: open && showCloseBar ? 0 : 14,
              borderBottomRightRadius: open && showCloseBar ? 0 : 14,
              background: "linear-gradient(180deg, #22c55e 0%, #0f766e 55%, #052e2b 100%)",
              border: "1px solid rgba(45, 212, 191, 0.95)",
              boxShadow: "0 0 10px rgba(45,212,191,0.72), 0 0 22px rgba(34,197,94,0.42)",
              color: "#ecfeff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              userSelect: "none",
              opacity: open && !showCloseBar ? 0 : 1,
              visibility: open && !showCloseBar ? "hidden" : "visible",
              overflow: "hidden",
              fontSize: open ? 13 : 15,
              fontWeight: 700,
              transition: "width 0.32s ease, min-width 0.32s ease, opacity 0.18s ease, box-shadow 0.32s ease",
            }}
            onClick={() => setOpen((value) => !value)}
            title={open ? "Close player jobs" : "Open player jobs"}
          >
            {open ? (showCloseBar ? "<" : "") : "📋"}
          </div>


          {open ? (
            <div
              style={{
                width: 248,
                background: "linear-gradient(180deg, rgba(14,22,34,0.92), rgba(8,12,20,0.9))",
                borderTop: "1px solid rgba(148, 163, 184, 0.35)",
                borderRight: "1px solid rgba(148, 163, 184, 0.35)",
                borderBottom: "1px solid rgba(148, 163, 184, 0.35)",
                borderTopRightRadius: 14,
                borderBottomRightRadius: 14,
                boxShadow: "0 14px 30px rgba(0,0,0,0.35)",
                color: "#f8fafc",
                padding: "12px 14px",
                backdropFilter: "blur(6px)",
                transformOrigin: "right center",
                animation: "playerStatusSlideOpen 340ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <style>
                {`
                  @keyframes playerStatusSlideOpen {
                    0% {
                      opacity: 0;
                      transform: translateX(18px) scaleX(0.78) scaleY(0.92);
                    }
                    100% {
                      opacity: 1;
                      transform: translateX(0) scaleX(1) scaleY(1);
                    }
                  }
                `}
              </style>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                  marginBottom: 14,
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid rgba(59, 130, 246, 0.18)",
                  background: "linear-gradient(180deg, rgba(8, 15, 26, 0.94), rgba(5, 10, 18, 0.9))",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "rgba(191, 219, 254, 0.85)",
                  }}
                >
                  Timers
                </div>

                <div style={{ display: "grid", gap: 14 }}>
                  {activeBuild ? (
                    <JobRow
                      label="Build"
                      title={activeBuild.title}
                      subtitle={activeBuild.subtitle}
                      remainingText={activeBuild.remainingText}
                      progressRatio={activeBuild.progressRatio ?? 0}
                      emptyText="No active build"
                    />
                  ) : null}

                  {activeResearch ? (
                    <JobRow
                      label="Research"
                      title={activeResearch.title}
                      subtitle={activeResearch.subtitle}
                      remainingText={activeResearch.remainingText}
                      progressRatio={activeResearch.progressRatio ?? 0}
                      emptyText="No active research"
                    />
                  ) : null}

                  {activeCraft ? (
                    <JobRow
                      label="Craft"
                      title={activeCraft.title}
                      subtitle={activeCraft.subtitle}
                      remainingText={activeCraft.remainingText}
                      progressRatio={activeCraft.progressRatio ?? 0}
                      emptyText="No active hand craft"
                    />
                  ) : null}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                  marginBottom: 14,
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid rgba(34, 197, 94, 0.16)",
                  background: "linear-gradient(180deg, rgba(6, 14, 18, 0.92), rgba(4, 10, 14, 0.9))",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "rgba(167, 243, 208, 0.9)",
                  }}
                >
                  Status
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <MiniVitalRow
                    label="Hunger"
                    current={statusSummary.hungerCurrent}
                    max={statusSummary.hungerMax}
                    color={hungerTone.fill}
                    trackColor="rgba(5, 10, 18, 0.72)"
                    percentText={formatPercent(statusSummary.hungerPercent)}
                    radius={4}
                    trackBorderColor={hungerTone.border}
                    pulse={hungerTone.pulse}
                    pulseColor={hungerTone.pulseColor}
                  />

                  <MiniVitalRow
                    label="Thirst"
                    current={statusSummary.thirstCurrent}
                    max={statusSummary.thirstMax}
                    color={thirstTone.fill}
                    trackColor="rgba(5, 10, 18, 0.72)"
                    percentText={formatPercent(statusSummary.thirstPercent)}
                    radius={4}
                    trackBorderColor={thirstTone.border}
                    pulse={thirstTone.pulse}
                    pulseColor={thirstTone.pulseColor}
                  />

                  <MiniVitalRow
                    label="Sleep"
                    current={statusSummary.sleepCurrent}
                    max={statusSummary.sleepMax}
                    color={sleepTone.fill}
                    trackColor="rgba(5, 10, 18, 0.72)"
                    percentText={`${Math.round(statusSummary.sleepMultiplier * 100)}% XP`}
                    radius={4}
                    trackBorderColor={sleepTone.border}
                    pulse={sleepTone.pulse}
                    pulseColor={sleepTone.pulseColor}
                  />

                  <MiniVitalRow
                    label="Immunity"
                    current={statusSummary.immunityCurrent}
                    max={statusSummary.immunityMax}
                    color={immunityTone.fill}
                    trackColor="rgba(5, 10, 18, 0.72)"
                    percentText={formatPercent(statusSummary.immunityPercent)}
                    radius={4}
                    trackBorderColor={immunityTone.border}
                    pulse={immunityTone.pulse}
                    pulseColor={immunityTone.pulseColor}
                  />
                </div>
              </div>

              <SkillsStatusBlock skillsSnapshot={skillsSnapshot} />
              {/* Builder controls moved to the shelter card */}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
