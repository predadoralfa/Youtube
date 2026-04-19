/**
 * src/world/scene/FloatingLootText.jsx
 *
 * Mostra mensagens de loot coletado no canto inferior direito.
 * - Reaproveita a ideia do texto flutuante
 * - Sobe e desaparece automaticamente
 * - Não intercepta eventos de mouse
 */

import React, { useEffect, useState } from "react";

export function FloatingLootText({ loots }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 50);

    return () => clearInterval(interval);
  }, []);

  if (!loots || loots.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 18,
        bottom: 18,
        zIndex: 2147483647,
        pointerEvents: "none",
        width: 360,
        height: 180,
      }}
    >
      {loots.map((loot) => {
        const startedAt = Number(loot?.startedAt ?? now);
        const duration = Number(loot?.ttlMs ?? 1200);
        const elapsed = Math.max(0, now - startedAt);
        const progress = duration > 0 ? Math.min(1, elapsed / duration) : 1;
        const offsetY = progress * 68;
        const opacity = Math.max(0, 1 - progress);
        const label = String(loot?.text ?? loot?.label ?? "Loot recebido");
        const subLabel = String(loot?.subtext ?? loot?.secondaryText ?? "").trim();
        const tone = String(loot?.tone ?? loot?.variant ?? "loot").toLowerCase();
        const isWarn = tone === "warn";
        const isDanger = tone === "danger";
        const borderColor = isDanger
          ? "rgba(255, 82, 120, 0.48)"
          : isWarn
            ? "rgba(255, 145, 0, 0.48)"
            : "rgba(74, 222, 128, 0.42)";
        const shadowColor = isDanger
          ? "rgba(255, 82, 120, 0.14)"
          : isWarn
            ? "rgba(255, 145, 0, 0.14)"
            : "rgba(74, 222, 128, 0.14)";
        const textColor = isDanger
          ? "#ffe4ea"
          : isWarn
            ? "#ffe2be"
            : "#dcfce7";
        const kickerColor = isDanger
          ? "#fda4af"
          : isWarn
            ? "#fdba74"
            : "#86efac";
        const subColor = isDanger
          ? "#fecdd3"
          : isWarn
            ? "#fed7aa"
            : "#93c5fd";

        return (
          <div
            key={loot.id}
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              transform: `translateY(${-offsetY}px)`,
              opacity,
              transition: "none",
            }}
          >
            <div
              style={{
                minWidth: 180,
                maxWidth: 320,
                padding: "8px 12px",
                borderRadius: 12,
                background: isDanger
                  ? "linear-gradient(180deg, rgba(56, 11, 22, 0.84), rgba(28, 5, 12, 0.92))"
                  : isWarn
                    ? "linear-gradient(180deg, rgba(61, 28, 0, 0.82), rgba(28, 12, 0, 0.9))"
                    : "rgba(7, 16, 24, 0.92)",
                border: `1px solid ${borderColor}`,
                boxShadow: `0 0 18px ${shadowColor}`,
                color: textColor,
                textAlign: "right",
                backdropFilter: "blur(8px)",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: kickerColor,
                  marginBottom: 2,
                }}
              >
                {isDanger ? "Warning" : isWarn ? "Warning" : "Loot"}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                color: textColor,
                textShadow: `0 0 8px ${shadowColor}`,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {label}
            </div>
            {subLabel ? (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  color: subColor,
                  textShadow: `0 0 8px ${isDanger ? "rgba(255,82,120,0.18)" : isWarn ? "rgba(255,145,0,0.18)" : "rgba(59,130,246,0.18)"}`,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {subLabel}
              </div>
            ) : null}
          </div>
        </div>
      );
    })}
    </div>
  );
}
