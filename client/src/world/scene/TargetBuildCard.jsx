import React, { useEffect, useState } from "react";

export function TargetBuildCard({
  visible = true,
  x = null,
  y = null,
  displayName = "Primitive Shelter",
  ownerName = "Unknown",
  stateLabel = "Planning",
  canCancel = false,
  canBuild = false,
  canPause = false,
  canResume = false,
  canDeposit = false,
  canSleep = false,
  canDismantle = false,
  sleepCurrent = null,
  sleepMax = null,
  buildState = null,
  buildDurationLabel = null,
  xpReward = 0,
  onCancel = null,
  onPause = null,
  onResume = null,
  onBuild = null,
  onDepositMaterial = null,
  onSleep = null,
  onDismantle = null,
  onClose = null,
}) {
  const [inlineNotice, setInlineNotice] = useState("");
  const [depositQtyByCode, setDepositQtyByCode] = useState({});
  const safeX = Number.isFinite(Number(x)) ? Number(x) : 0;
  const safeY = Number.isFinite(Number(y)) ? Number(y) : 0;
  const safeDisplayName = String(displayName ?? "Primitive Shelter").trim() || "Primitive Shelter";
  const safeOwnerName = String(ownerName ?? "Unknown").trim() || "Unknown";
  const safeStateLabel = String(stateLabel ?? "Planning").trim() || "Planning";
  const safeRequirements = Array.isArray(buildState?.requirements) ? buildState.requirements : [];
  const safeProgressRatio = Number.isFinite(Number(buildState?.progressRatio))
    ? Math.max(0, Math.min(1, Number(buildState.progressRatio)))
    : 0;
  const safeDurationMs = Math.max(0, Number(buildState?.durationMs ?? 0));
  const safeProgressMs = Math.max(0, Number(buildState?.progressMs ?? 0));
  const remainingMs = Math.max(0, safeDurationMs - safeProgressMs);
  const remainingMinutes = Math.floor(remainingMs / 60000);
  const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
  const safeCountdownLabel =
    remainingMinutes > 0
      ? `${remainingMinutes}m ${String(remainingSeconds).padStart(2, "0")}s`
      : `${remainingSeconds}s`;
  const safeXpReward = Math.max(0, Number(xpReward ?? buildState?.xpReward ?? 0));
  const isCompleted = Boolean(buildState?.isCompleted) || safeStateLabel.toUpperCase() === "COMPLETED";
  const safeSleepCurrent = Math.max(0, Number(sleepCurrent ?? 0));
  const safeSleepMax = Math.max(1, Number(sleepMax ?? 1));
  const sleepRatio = Math.min(1, Math.max(0, safeSleepCurrent / safeSleepMax));
  const isRunning = Boolean(buildState?.isRunning);
  const isPaused = String(buildState?.constructionState ?? "").toUpperCase() === "PAUSED";

  useEffect(() => {
    setInlineNotice("");
  }, [safeDisplayName, stateLabel, buildState?.constructionState, buildState?.progressText]);

  const handleResume = async () => {
    setInlineNotice("");
    const result = await onResume?.();
    if (result?.ok === true) return;

    const message =
      result?.code === "BUILD_TOO_FAR"
        ? "You need to be inside the marked area to resume building."
        : result?.message || result?.code || "Failed to resume building.";
    setInlineNotice(message);
  };

  const handlePause = async () => {
    setInlineNotice("");
    await onPause?.();
  };

  const handleCancel = async () => {
    setInlineNotice("");
    await onCancel?.();
  };
  const formatRequirementLabel = (value) =>
    String(value ?? "")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase()) || "Item";

  const requirementsSignature = safeRequirements
    .map((requirement) => `${String(requirement?.itemCode ?? "ITEM").trim()}:${Math.max(1, Number(requirement?.requiredQty ?? 1))}`)
    .join("|");

  useEffect(() => {
    setDepositQtyByCode((current) => {
      const next = {};
      for (const requirement of safeRequirements) {
        const itemCode = String(requirement?.itemCode ?? "ITEM").trim() || "ITEM";
        const heldQty = Math.max(0, Number(requirement?.heldQty ?? 0));
        const existingValue = Number(current?.[itemCode]);
        next[itemCode] =
          Number.isInteger(existingValue) && existingValue > 0
            ? existingValue
            : heldQty > 0
              ? Math.max(1, Math.min(heldQty, Math.max(1, Number(requirement?.requiredQty ?? 1))))
              : 1;
      }
      return next;
    });
  }, [requirementsSignature]);

  const handleDeposit = async (requirement) => {
    setInlineNotice("");
    const itemCode = String(requirement?.itemCode ?? "").trim().toUpperCase();
    const heldQty = Math.max(0, Number(requirement?.heldQty ?? 0));
    const depositQty = Math.max(1, Math.floor(Number(depositQtyByCode[itemCode] ?? 1)));

    if (!itemCode) {
      setInlineNotice("Invalid requirement.");
      return;
    }
    if (!Number.isInteger(depositQty) || depositQty <= 0) {
      setInlineNotice("Enter a valid quantity.");
      return;
    }
    if (heldQty <= 0) {
      setInlineNotice("Put the item in your hands first.");
      return;
    }
    if (depositQty > heldQty) {
      setInlineNotice(`You only have ${heldQty} in hand.`);
      return;
    }

    const result = await onDepositMaterial?.(itemCode, depositQty);
    if (result?.ok === true) {
      const nextRequirements = safeRequirements.map((entry) => {
        const nextCode = String(entry?.itemCode ?? "ITEM").trim().toUpperCase();
        const required = Math.max(1, Number(entry?.requiredQty ?? entry?.quantity ?? 1));
        const currentHave = Math.max(0, Number(entry?.haveQty ?? 0));
        const currentHeld = Math.max(0, Number(entry?.heldQty ?? 0));
        const nextHave = nextCode === itemCode ? currentHave + depositQty : currentHave;
        const nextHeld = nextCode === itemCode ? Math.max(0, currentHeld - depositQty) : currentHeld;
        return {
          ...entry,
          itemCode: nextCode,
          requiredQty: required,
          haveQty: nextHave,
          heldQty: nextHeld,
          isMet: nextHave >= required,
        };
      });

      if (nextRequirements.length > 0 && nextRequirements.every((entry) => entry.isMet)) {
        window.setTimeout(() => {
          onBuild?.();
        }, 0);
      }
      return;
    }

    setInlineNotice(result?.message || result?.code || "Failed to deposit materials.");
  };

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
        {!isCompleted ? <span>Owner: {safeOwnerName}</span> : null}
        <span>Status: {safeStateLabel}</span>
      </div>

      {!isCompleted && safeRequirements.length > 0 ? (
        <div className="research-requirements">
          <div className="research-requirements-title">Deposit Materials</div>
          {safeRequirements.map((requirement) => {
            const requiredQty = Math.max(0, Number(requirement?.requiredQty ?? requirement?.quantity ?? 0));
            const haveQty = Math.max(0, Number(requirement?.haveQty ?? 0));
            const heldQty = Math.max(0, Number(requirement?.heldQty ?? 0));
            const isMet = Boolean(requirement?.isMet);
            const itemCode = String(requirement?.itemCode ?? "ITEM").trim() || "ITEM";
            const inputValue = Math.max(1, Math.floor(Number(depositQtyByCode[itemCode] ?? 1)));

            return (
              <div
                key={`${itemCode}:${requiredQty}`}
                className={`research-requirement ${isMet ? "is-ready" : "is-missing"}`}
                style={{ gap: 8 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <span className="research-requirement-label">{formatRequirementLabel(itemCode)}</span>
                  <span className="research-requirement-count">
                    <strong>{haveQty}</strong>
                    <span> / {requiredQty}</span>
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11, color: "rgba(226, 232, 240, 0.75)" }}>
                  <span>In hand: {heldQty}</span>
                  <span>Deposited: {haveQty}</span>
                </div>
                {!isMet && canDeposit ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="number"
                      min={1}
                      max={heldQty || requiredQty}
                      step={1}
                      value={inputValue}
                      onChange={(event) => {
                        const nextValue = Math.max(1, Math.floor(Number(event.target.value ?? 1)));
                        setDepositQtyByCode((current) => ({
                          ...current,
                          [itemCode]: nextValue,
                        }));
                      }}
                      style={{
                        width: 72,
                        height: 30,
                        borderRadius: 8,
                        border: "1px solid rgba(245, 158, 11, 0.35)",
                        background: "rgba(10, 14, 24, 0.9)",
                        color: "#fff7ed",
                        padding: "0 8px",
                        fontSize: 12,
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      className="research-action"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => handleDeposit(requirement)}
                      disabled={!onDepositMaterial || heldQty <= 0}
                    >
                      Deposit
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {!isCompleted ? (
        <div className="research-meta">
          <span>{safeCountdownLabel}</span>
          <span>XP +{safeXpReward}</span>
        </div>
      ) : null}

      {!isCompleted && buildState?.isRunning ? (
        <div className="research-progress">
          <div className="research-progress-track" aria-hidden="true">
            <span style={{ width: `${Math.round(safeProgressRatio * 100)}%` }} />
          </div>
          <div className="research-progress-copy">
            {buildState.progressText ?? `${Math.round(safeProgressRatio * 100)}%`}
          </div>
        </div>
      ) : null}

      {inlineNotice ? (
        <div
          style={{
            fontSize: 11,
            color: "#fca5a5",
            borderRadius: 10,
            padding: "8px 10px",
            border: "1px solid rgba(248, 113, 113, 0.28)",
            background: "rgba(127, 29, 29, 0.18)",
            lineHeight: 1.35,
          }}
        >
          {inlineNotice}
        </div>
      ) : null}

      {isCompleted ? (
        <div style={{ display: "grid", gap: 8 }}>
          {canSleep ? (
            <div style={{ display: "grid", gap: 6 }}>
              <div
                style={{
                  height: 12,
                  overflow: "hidden",
                  borderRadius: 999,
                  border: "1px solid rgba(52, 211, 153, 0.35)",
                  background: "rgba(5, 10, 18, 0.72)",
                }}
              >
                <div
                  style={{
                    width: `${Math.round(sleepRatio * 100)}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: "linear-gradient(90deg, rgba(52,211,153,0.95), rgba(34,197,94,0.9))",
                    transition: "width 240ms ease",
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11, color: "rgba(226, 232, 240, 0.76)" }}>
                <span>Sleep</span>
                <span>{Math.round(safeSleepCurrent)} / {Math.round(safeSleepMax)} ({Math.round(sleepRatio * 100)}%)</span>
              </div>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 8 }}>
            {canSleep ? (
              <button
                type="button"
                className="research-action"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => onSleep?.()}
              >
                Sleep
              </button>
            ) : null}

            {canDismantle ? (
              <button
                type="button"
                className="research-action research-action--danger"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => onDismantle?.()}
              >
                Demolish
              </button>
            ) : null}
          </div>
        </div>
      ) : isRunning || isPaused ? (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {canPause && isRunning ? (
              <button
                type="button"
                className="research-action"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => handlePause()}
              >
                Pause
              </button>
            ) : null}

            {canResume && isPaused ? (
              <button
                type="button"
                className="research-action"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => handleResume()}
              >
                Resume
              </button>
            ) : null}

            {canCancel ? (
              <button
                type="button"
                className="research-action research-action--danger"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => handleCancel()}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
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
          {buildState?.isRunning ? "Building" : buildState?.isCompleted ? "Completed" : canDeposit ? "Deposit Materials" : "Missing Requirements"}
        </button>
      )}

      {!isCompleted && canCancel ? (
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
