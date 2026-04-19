import React from "react";

export function TargetBuildCard({
  visible = true,
  x = null,
  y = null,
  displayName = "Primitive Shelter",
  ownerName = "Unknown",
  stateLabel = "Planning",
  canCancel = false,
  canBuild = false,
  canSleep = false,
  buildState = null,
  buildDurationLabel = null,
  xpReward = 0,
  onCancel = null,
  onBuild = null,
  onSleep = null,
  onClose = null,
}) {
  const safeX = Number.isFinite(Number(x)) ? Number(x) : 0;
  const safeY = Number.isFinite(Number(y)) ? Number(y) : 0;
  const safeDisplayName = String(displayName ?? "Primitive Shelter").trim() || "Primitive Shelter";
  const safeOwnerName = String(ownerName ?? "Unknown").trim() || "Unknown";
  const safeStateLabel = String(stateLabel ?? "Planning").trim() || "Planning";
  const safeRequirements = Array.isArray(buildState?.requirements) ? buildState.requirements : [];
  const safeProgressRatio = Number.isFinite(Number(buildState?.progressRatio))
    ? Math.max(0, Math.min(1, Number(buildState.progressRatio)))
    : 0;
  const safeProgressLabel =
    String(buildDurationLabel ?? buildState?.progressLabel ?? "0s / 3m").trim() || "0s / 3m";
  const safeXpReward = Math.max(0, Number(xpReward ?? buildState?.xpReward ?? 0));
  const isCompleted = Boolean(buildState?.isCompleted) || safeStateLabel.toUpperCase() === "COMPLETED";
  const formatRequirementLabel = (value) =>
    String(value ?? "")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase()) || "Item";

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: `${safeX}px`,
        top: `${safeY}px`,
        transform: "translate(-50%, -115%)",
        minWidth: "220px",
        maxWidth: "260px",
        padding: "12px 14px",
        borderRadius: 14,
        background: "linear-gradient(180deg, rgba(22, 18, 8, 0.96), rgba(13, 11, 4, 0.92))",
        border: "1px solid rgba(245, 158, 11, 0.55)",
        boxShadow: "0 10px 28px rgba(0, 0, 0, 0.45), 0 0 18px rgba(251, 191, 36, 0.16)",
        color: "#fffbeb",
        pointerEvents: "auto",
        zIndex: 1125,
        backdropFilter: "blur(10px)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: "rgba(253, 224, 71, 0.95)",
          fontWeight: 700,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {safeDisplayName}
      </div>

      <div
        style={{
          fontSize: 12,
          lineHeight: 1.35,
          color: "rgba(254, 243, 199, 0.88)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <span>Owner: {safeOwnerName}</span>
        <span>Status: {safeStateLabel}</span>
      </div>

      {safeRequirements.length > 0 ? (
        <div className="research-requirements">
          <div className="research-requirements-title">Requirements</div>
          {safeRequirements.map((requirement) => {
            const requiredQty = Math.max(0, Number(requirement?.requiredQty ?? requirement?.quantity ?? 0));
            const haveQty = Math.max(0, Number(requirement?.haveQty ?? 0));
            const isMet = Boolean(requirement?.isMet);
            const itemCode = String(requirement?.itemCode ?? "ITEM").trim() || "ITEM";

            return (
              <div
                key={`${itemCode}:${requiredQty}`}
                className={`research-requirement ${isMet ? "is-ready" : "is-missing"}`}
              >
                <span className="research-requirement-label">{formatRequirementLabel(itemCode)}</span>
                <span className="research-requirement-count">
                  <strong>{haveQty}</strong>
                  <span> / {requiredQty}</span>
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

        <div className="research-meta">
        <span>{safeProgressLabel}</span>
        <span>XP +{safeXpReward}</span>
      </div>

      {buildState?.isRunning ? (
        <div className="research-progress">
          <div className="research-progress-track" aria-hidden="true">
            <span style={{ width: `${Math.round(safeProgressRatio * 100)}%` }} />
          </div>
          <div className="research-progress-copy">
            {buildState.progressText ?? `${Math.round(safeProgressRatio * 100)}%`}
          </div>
        </div>
      ) : null}

      {isCompleted && canSleep ? (
        <button
          type="button"
          className="research-action"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => onSleep?.()}
        >
          Sleep
        </button>
      ) : canBuild ? (
        <button
          type="button"
          className="research-action"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => onBuild?.()}
        >
          Build
        </button>
      ) : (
        <button type="button" className="research-action" disabled>
          {buildState?.isRunning ? "Building" : buildState?.isCompleted ? "Completed" : "Missing Requirements"}
        </button>
      )}

      {canCancel ? (
        <button
          type="button"
          className="research-action research-action--danger"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => onCancel?.()}
        >
          Cancel Project
        </button>
      ) : null}
    </div>
  );
}
