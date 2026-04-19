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
    title: "Primitive Shelter",
    subtitle: sleepLock?.pending ? "Approaching shelter" : "Sleeping",
    remainingText: sleepLock?.pending ? "ESC to cancel" : "ESC to wake",
    progressRatio: 1,
    progressText: sleepLock?.pending ? "Approaching" : "Sleeping",
  };
}

function JobRow({ label, title, subtitle, remainingText, progressRatio, emptyText, extra = null }) {
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
        <span style={{ color: "rgba(248, 250, 252, 0.82)", fontSize: 11 }}>
          {hasJob ? remainingText : "idle"}
        </span>
      </div>

      <div style={{ color: "#f8fafc", fontSize: 13, fontWeight: 700, lineHeight: 1.15 }}>
        {hasJob ? title : emptyText}
      </div>

      {hasJob && subtitle ? (
        <div style={{ color: "rgba(226, 232, 240, 0.68)", fontSize: 11, lineHeight: 1.25 }}>
          {subtitle}
        </div>
      ) : null}

      <div
        style={{
          height: 8,
          overflow: "hidden",
          border: "1px solid rgba(56, 189, 248, 0.24)",
          borderRadius: 8,
          background: "rgba(5, 10, 18, 0.72)",
        }}
      >
        <div
          style={{
            width: `${Math.round(clamp01(progressRatio) * 100)}%`,
            height: "100%",
            borderRadius: 8,
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

export function PlayerStatusPanel({
  snapshot,
  researchSnapshot,
  inventorySnapshot,
  equipmentSnapshot,
  onCancelBuild = null,
  onPauseBuild = null,
  onResumeBuild = null,
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

  return (
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
          {open ? "<" : "📋"}
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
              <JobRow
                label="Research"
                title={activeResearch?.title}
                subtitle={activeResearch?.subtitle}
                remainingText={activeResearch?.remainingText}
                progressRatio={activeResearch?.progressRatio ?? 0}
                emptyText="No active research"
              />

              <JobRow
                label="Craft"
                title={activeCraft?.title}
                subtitle={activeCraft?.subtitle}
                remainingText={activeCraft?.remainingText}
                progressRatio={activeCraft?.progressRatio ?? 0}
                emptyText="No active hand craft"
              />

              <JobRow
                label="Builder"
                title={activeBuild?.title}
                subtitle={activeBuild?.subtitle}
                remainingText={activeBuild?.remainingText}
                progressRatio={activeBuild?.progressRatio ?? 0}
                emptyText="No active construction"
                extra={
                  activeBuild ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ color: "rgba(226, 232, 240, 0.78)", fontSize: 11 }}>
                        {activeBuild.progressText}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {activeBuild.canPause ? (
                          <button
                            type="button"
                            style={{
                              flex: 1,
                              borderRadius: 8,
                              border: "1px solid rgba(59, 130, 246, 0.45)",
                              background: "rgba(37, 99, 235, 0.22)",
                              color: "#dbeafe",
                              padding: "8px 10px",
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                            onClick={() => onPauseBuild?.(activeBuild.actorId)}
                          >
                            Pause
                          </button>
                        ) : null}

                        {activeBuild.canResume ? (
                          <button
                            type="button"
                            style={{
                              flex: 1,
                              borderRadius: 8,
                              border: "1px solid rgba(34, 197, 94, 0.45)",
                              background: "rgba(22, 163, 74, 0.22)",
                              color: "#dcfce7",
                              padding: "8px 10px",
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                            onClick={() => onResumeBuild?.(activeBuild.actorId)}
                          >
                            Resume
                          </button>
                        ) : null}

                        {activeBuild.canCancel ? (
                          <button
                            type="button"
                            style={{
                              flex: 1,
                              borderRadius: 8,
                              border: "1px solid rgba(239, 68, 68, 0.45)",
                              background: "rgba(127, 29, 29, 0.35)",
                              color: "#fecaca",
                              padding: "8px 10px",
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                            onClick={() => onCancelBuild?.(activeBuild.actorId)}
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null
                }
              />

              <JobRow
                label="Sleep"
                title={activeSleep?.title}
                subtitle={activeSleep?.subtitle}
                remainingText={activeSleep?.remainingText}
                progressRatio={activeSleep?.progressRatio ?? 0}
                emptyText="No active sleep"
                extra={activeSleep ? (
                  <div style={{ color: "rgba(220, 252, 231, 0.8)", fontSize: 11 }}>
                    {activeSleep.progressText}
                  </div>
                ) : null}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
