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

export function FloatingDamageText({ damages }) {
  const [now, setNow] = useState(() => Date.now());

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
              position: "absolute",
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

  return content;
}
