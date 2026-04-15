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
  const barWidth = Math.max(208, Math.min(388, Math.floor(cardWidth - 32)));

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
        width={barWidth}
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
