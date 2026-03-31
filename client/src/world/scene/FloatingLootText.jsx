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
                background: "rgba(7, 16, 24, 0.92)",
                border: "1px solid rgba(74, 222, 128, 0.42)",
                boxShadow: "0 0 18px rgba(74, 222, 128, 0.14)",
                color: "#dcfce7",
                textAlign: "right",
                backdropFilter: "blur(8px)",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#86efac",
                  marginBottom: 2,
                }}
              >
                Loot
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#f0fdf4",
                  textShadow: "0 0 8px rgba(74,222,128,0.16)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
