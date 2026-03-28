/**
 * src/world/scene/FloatingDamageText.jsx
 * 
 * Papel:
 * - Mostrar texto de dano flutuante acima da cabeça da entidade que levou dano
 * - Desaparecer após animação
 * 
 * Fonte da verdade:
 * - Backend (snapshot inicial + atualizações confirmadas via socket).
 * - Este arquivo NUNCA decide estado do mundo, apenas renderiza e envia intenção.
 * 
 * NÃO FAZ: 
 * - Não calcula dano, nem decide se é critico
 * - Não decide posição final do texto (deixa para GameCanvas)
 * - Não calcula animação (deixa para React)
 * - Não decide se o texto deve aparecer (deixa para GameCanvas)
 * - Não decide se o texto deve desaparecer (deixa para React)
 * - Não decide se o texto deve ser critico (deixa para GameCanvas)
 * - Não decide se o texto deve ser normal (deixa para GameCanvas)
 * - Não decide se o texto deve ser grande (deixa para GameCanvas)
 * - Não decide se o texto deve ser pequeno (deixa para GameCanvas)
 * - Não decide se o texto deve ser vermelho (deixa para GameCanvas)
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

export function FloatingDamageText({ damages }) {
  const [floatingTexts, setFloatingTexts] = useState([]);
  const seenDamageIdsRef = useRef(new Set());

  useLayoutEffect(() => {
    if (!damages || damages.length === 0) {
      setFloatingTexts([]);
      seenDamageIdsRef.current.clear();
      return;
    }

    const seen = seenDamageIdsRef.current;
    const newTexts = [];

    for (let idx = 0; idx < damages.length; idx += 1) {
      const dmg = damages[idx];
      if (!dmg || dmg.id == null) continue;
      if (seen.has(dmg.id)) continue;

      seen.add(dmg.id);
      newTexts.push({
        id: dmg.id,
        x: dmg.screenX,
        y: dmg.screenY,
        damage: dmg.damage,
        isCrit: dmg.isCrit ?? false,
        startTime: Date.now(),
      });
    }

    if (newTexts.length === 0) return;
    setFloatingTexts((prev) => [...prev, ...newTexts]);
  }, [damages]);

  // Remover textos que já finalizaram animação
  useEffect(() => {
    const interval = setInterval(() => {
      setFloatingTexts((prev) => {
        const now = Date.now();
        const alive = [];
        const removed = [];

        for (const text of prev) {
          if (now - text.startTime < 1500) {
            alive.push(text);
          } else {
            removed.push(text);
          }
        }

        if (removed.length > 0) {
          const seen = seenDamageIdsRef.current;
          for (const text of removed) {
            seen.delete(text.id);
          }
        }

        return alive;
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {floatingTexts.map((text) => {
        const elapsed = Date.now() - text.startTime;
        const duration = 1500; // ms
        const progress = elapsed / duration;

        // Animar: move para cima e desaparece
        const offsetY = progress * 80; // 80px para cima
        const opacity = Math.max(0, 1 - progress);

        return (
          <div
            key={text.id}
            style={{
              position: "fixed",
              left: `${text.x}px`,
              top: `${text.y - offsetY}px`,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              zIndex: 2000,
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
}
