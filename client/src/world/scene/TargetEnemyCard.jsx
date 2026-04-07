import React from "react";
import { HPBar } from "./HPBar";

export function TargetEnemyCard({
  visible = true,
  x = null,
  y = null,
  enemyName = "Enemy",
  hpCurrent = 0,
  hpMax = 0,
}) {
  if (!visible) return null;
  if (!Number.isFinite(Number(hpMax)) || Number(hpMax) <= 0) return null;

  const safeX = Number.isFinite(Number(x)) ? Number(x) : 0;
  const safeY = Number.isFinite(Number(y)) ? Number(y) : 0;
  const safeName = String(enemyName ?? "Enemy").trim() || "Enemy";

  return (
    <div
      style={{
        position: "fixed",
        left: `${safeX}px`,
        top: `${safeY}px`,
        transform: "translate(-50%, -118%)",
        minWidth: "244px",
        maxWidth: "244px",
        padding: "12px 14px",
        borderRadius: 14,
        background: "linear-gradient(180deg, rgba(32, 10, 10, 0.95), rgba(18, 7, 7, 0.92))",
        border: "1px solid rgba(248, 113, 113, 0.55)",
        boxShadow:
          "0 10px 28px rgba(0, 0, 0, 0.45), 0 0 18px rgba(239, 68, 68, 0.2)",
        color: "#fee2e2",
        pointerEvents: "none",
        zIndex: 1125,
        backdropFilter: "blur(10px)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: "rgba(252, 165, 165, 0.92)",
          fontWeight: 700,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {safeName}
      </div>

      <div
        style={{
          fontSize: 12,
          lineHeight: 1.2,
          color: "rgba(254, 226, 226, 0.84)",
          fontWeight: 600,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        HP
      </div>

      <HPBar
        visible={true}
        mode="hud"
        width={216}
        hpHeight={12}
        hpCurrent={hpCurrent}
        hpMax={hpMax}
        showHpText={true}
        hpTextFontSize="12px"
        showStamina={false}
        trackColor="rgba(32, 32, 32, 0.92)"
        borderColor="rgba(127, 29, 29, 0.9)"
      />
    </div>
  );
}
