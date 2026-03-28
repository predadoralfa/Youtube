/**
 * src/world/scene/FloatingDamageText.jsx
 *
 * Papel:
 * - Mostrar texto de dano flutuante acima da cabeca da entidade que levou dano
 * - Renderizar somente os hits vivos recebidos do backend
 *
 * Fonte da verdade:
 * - Backend confirma cada hit via socket.
 * - Este componente apenas desenha o snapshot atual dos hits ativos.
 */

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function FloatingDamageText({ damages }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const testNode = document.createElement("div");
    testNode.setAttribute("data-floating-damage-test", "true");
    testNode.textContent = "TEST_RENDER";
    Object.assign(testNode.style, {
      position: "fixed",
      left: "24px",
      top: "24px",
      zIndex: "2147483647",
      pointerEvents: "none",
      padding: "6px 10px",
      borderRadius: "6px",
      background: "rgba(255, 0, 0, 0.95)",
      color: "#fff",
      fontSize: "14px",
      fontWeight: "700",
      boxShadow: "0 0 8px rgba(0,0,0,0.4)",
    });

    document.body.appendChild(testNode);

    return () => {
      testNode.remove();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 50);

    return () => clearInterval(interval);
  }, []);

  if (!damages || damages.length === 0) {
    return null;
  }

  const content = (
    <>
      <div
        style={{
          position: "fixed",
          left: "24px",
          top: "64px",
          zIndex: 2147483647,
          pointerEvents: "none",
          padding: "6px 10px",
          borderRadius: "6px",
          background: "rgba(0, 0, 0, 0.85)",
          color: "#00ff88",
          fontSize: "12px",
          fontWeight: 700,
          boxShadow: "0 0 8px rgba(0,0,0,0.4)",
        }}
      >
        DAMAGE_COUNT={damages.length} FIRST=
        {Number.isFinite(Number(damages[0]?.screenX ?? damages[0]?.x)) && Number.isFinite(Number(damages[0]?.screenY ?? damages[0]?.y))
          ? `${Number(damages[0].screenX ?? damages[0].x).toFixed(1)},${Number(damages[0].screenY ?? damages[0].y).toFixed(1)}`
          : "invalid"}
      </div>

      {damages.map((text) => {
        const screenX = Number(text?.screenX ?? text?.x);
        const screenY = Number(text?.screenY ?? text?.y);

        if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) {
          return null;
        }

        const startedAt = Number(text?.startedAt ?? now);
        const duration = Number(text?.ttlMs ?? 1200);
        const elapsed = Math.max(0, now - startedAt);
        const progress = duration > 0 ? Math.min(1, elapsed / duration) : 1;

        const offsetY = progress * 80;
        const opacity = Math.max(0, 1 - progress);

        return (
          <div
            key={text.id}
            style={{
              position: "fixed",
              left: `${screenX}px`,
              top: `${screenY - offsetY}px`,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              zIndex: 2147483647,
              opacity,
              transition: "none",
            }}
          >
            <div
              style={{
                fontSize: text.isCrit ? "28px" : "20px",
                fontWeight: "bold",
                color: text.isCrit ? "#ffff00" : "#ff6b35",
                textShadow: `
                  0 0 2px rgba(0,0,0,0.8),
                  0 0 4px rgba(0,0,0,0.6),
                  0 0 8px rgba(255,107,53,0.4)
                `,
                whiteSpace: "nowrap",
                transform: text.isCrit ? "scale(1.3)" : "scale(1)",
              }}
            >
              {text.isCrit ? "⚡" : ""} {text.damage}
            </div>
          </div>
        );
      })}
    </>
  );

  if (typeof document === "undefined") {
    return content;
  }

  return createPortal(content, document.body);
}
