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

  const safeName = String(enemyName ?? "Enemy").trim() || "Enemy";
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
  const cardWidth = Math.max(240, Math.min(420, Math.floor(viewportWidth * 0.34)));
  const barWidth = Math.max(208, Math.min(392, Math.floor(cardWidth - 28)));

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        top: "clamp(20px, 2.4vh, 30px)",
        transform: "translateX(-50%)",
        width: `min(92vw, ${cardWidth}px)`,
        maxWidth: "92vw",
        padding: "12px 14px",
        borderRadius: 14,
        background: "linear-gradient(180deg, rgba(48, 12, 12, 0.58), rgba(24, 8, 8, 0.42))",
        border: "1px solid rgba(248, 113, 113, 0.32)",
        boxShadow:
          "0 8px 22px rgba(0, 0, 0, 0.34), 0 0 14px rgba(239, 68, 68, 0.14)",
        color: "#fecaca",
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
          fontSize: 16,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "rgba(252, 165, 165, 0.96)",
          fontWeight: 800,
          textAlign: "center",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          lineHeight: 1.1,
        }}
      >
        {safeName}
      </div>

      <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <HPBar
          visible={true}
          mode="hud"
          width={barWidth}
          hpHeight={24}
          hpCurrent={hpCurrent}
          hpMax={hpMax}
          showHpText={true}
          showHpLabel={false}
          hpTextFontSize="16px"
          showStamina={false}
          trackColor="rgba(42, 10, 10, 0.92)"
          borderColor="rgba(153, 27, 27, 0.92)"
          hpColorHigh="#ef4444"
          hpColorLow="#991b1b"
        />
      </div>
    </div>
  );
}
