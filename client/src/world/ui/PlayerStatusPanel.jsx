import { useEffect, useMemo, useState } from "react";

import { resolvePrimitiveShelterBuildRequirements } from "@/world/build/requirements";

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
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
          height: 10,
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
  const statusSummary = useMemo(() => resolveStatusSnapshot(snapshot), [snapshot]);
  const activeJobs = [activeResearch, activeCraft].filter(Boolean);
  const isLowWarn = (current, max) => Number(max ?? 0) > 0 && Number(current ?? 0) / Number(max ?? 1) <= 0.3;
  const isCritical = (current, max) => Number(max ?? 0) > 0 && Number(current ?? 0) <= 5;
  const hungerWarning = isLowWarn(statusSummary.hungerCurrent, statusSummary.hungerMax);
  const thirstWarning = isLowWarn(statusSummary.thirstCurrent, statusSummary.thirstMax);
  const sleepWarning = isLowWarn(statusSummary.sleepCurrent, statusSummary.sleepMax);
  const immunityWarning = isLowWarn(statusSummary.immunityCurrent, statusSummary.immunityMax);
  const hungerCritical = isCritical(statusSummary.hungerCurrent, statusSummary.hungerMax);
  const thirstCritical = isCritical(statusSummary.thirstCurrent, statusSummary.thirstMax);
  const sleepCritical = isCritical(statusSummary.sleepCurrent, statusSummary.sleepMax);
  const immunityCritical = isCritical(statusSummary.immunityCurrent, statusSummary.immunityMax);

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
          top: 58,
          right: 16,
          zIndex: 1099,
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
              width: open ? 22 : 28,
              minWidth: open ? 22 : 28,
              borderRadius: 14,
              borderTopRightRadius: open ? 0 : 14,
              borderBottomRightRadius: open ? 0 : 14,
              background: "linear-gradient(180deg, #22c55e 0%, #0f766e 55%, #052e2b 100%)",
              border: "1px solid rgba(45, 212, 191, 0.95)",
              boxShadow: "0 0 10px rgba(45,212,191,0.72), 0 0 22px rgba(34,197,94,0.42)",
              color: "#ecfeff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              userSelect: "none",
              fontSize: open ? 13 : 15,
              fontWeight: 700,
              transition: "width 0.32s ease, min-width 0.32s ease, box-shadow 0.32s ease",
            }}
            onClick={() => setOpen((value) => !value)}
            title={open ? "Close player jobs" : "Open player jobs"}
            >
             {open ? "<" : "▦"}
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
                  Status
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <MiniVitalRow
                    label="Hunger"
                    current={statusSummary.hungerCurrent}
                    max={statusSummary.hungerMax}
                    color="linear-gradient(90deg, rgba(56,189,248,0.95), rgba(14,165,233,0.9))"
                    trackColor="rgba(5, 10, 18, 0.72)"
                    pulse={hungerWarning}
                    pulseColor={hungerCritical ? "rgba(239, 68, 68, 0.9)" : "rgba(251, 146, 60, 0.9)"}
                  />

                  <MiniVitalRow
                    label="Thirst"
                    current={statusSummary.thirstCurrent}
                    max={statusSummary.thirstMax}
                    color="linear-gradient(90deg, rgba(34,211,238,0.95), rgba(6,182,212,0.9))"
                    trackColor="rgba(5, 10, 18, 0.72)"
                    pulse={thirstWarning}
                    pulseColor={thirstCritical ? "rgba(239, 68, 68, 0.9)" : "rgba(251, 146, 60, 0.9)"}
                  />

                  <MiniVitalRow
                    label="Sleep"
                    current={statusSummary.sleepCurrent}
                    max={statusSummary.sleepMax}
                    color="linear-gradient(90deg, rgba(52,211,153,0.95), rgba(34,197,94,0.9))"
                    trackColor="rgba(5, 10, 18, 0.72)"
                    pulse={sleepWarning}
                    pulseColor={sleepCritical ? "rgba(239, 68, 68, 0.9)" : "rgba(251, 146, 60, 0.9)"}
                  />
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  <MiniVitalRow
                    label="Immunity"
                    current={statusSummary.immunityCurrent}
                    max={statusSummary.immunityMax}
                    color="linear-gradient(90deg, rgba(96,165,250,0.95), rgba(34,197,94,0.9))"
                    trackColor="rgba(5, 10, 18, 0.72)"
                    percentText={`${statusSummary.immunityPercent.toFixed(1)}%`}
                    radius={10}
                    trackBorderColor="rgba(96, 165, 250, 0.24)"
                    pulse={immunityWarning}
                    pulseColor={immunityCritical ? "rgba(239, 68, 68, 0.9)" : "rgba(251, 146, 60, 0.9)"}
                  />

                  {statusSummary.feverActive && statusSummary.feverCurrent > 0 ? (
                    <JobRow
                      label="Fever"
                      title={`${statusSummary.feverCurrent}`}
                      subtitle={null}
                      remainingText={statusSummary.feverActive ? "Active" : "Clear"}
                      progressPercent={statusSummary.feverPercent}
                      emptyText="No fever data"
                    />
                  ) : null}
                </div>
              </div>

              {activeJobs.length > 0 ? (
                <>
                  <div
                    style={{
                      fontSize: 12,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "rgba(191, 219, 254, 0.85)",
                      marginBottom: 12,
                    }}
                  >
                    Tasks / Jobs
                  </div>

                  <div style={{ display: "grid", gap: 14 }}>
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

                    {/* Builder controls moved to the shelter card */}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
