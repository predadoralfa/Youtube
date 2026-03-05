// cliente/src/World/components/CooldownBar.jsx
import { useEffect, useState } from "react";
import "@/style/cooldownBar.css";

/**
 * CooldownBar
 *
 * Barra visual que mostra o cooldown entre coletas.
 * - Triggered por `onActorCollected`
 * - Anima de 100% → 0% em 1 segundo
 * - Desaparece quando completa
 *
 * Props:
 * - visible: boolean (controlado por parent)
 * - onComplete: () => void (callback quando cooldown termina)
 */
export function CooldownBar({ visible, onComplete }) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!visible) {
      setIsAnimating(false);
      setProgress(100);
      return;
    }

    setIsAnimating(true);
    setProgress(100);

    const startTime = Date.now();
    const cooldownMs = 1000;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / cooldownMs) * 100);

      setProgress(remaining);

      if (remaining > 0) {
        requestAnimationFrame(tick);
      } else {
        setIsAnimating(false);
        setProgress(0);
        if (onComplete) onComplete();
      }
    };

    tick();
  }, [visible, onComplete]);

  if (!isAnimating && progress <= 0) {
    return null;
  }

  return (
    <div className="cooldown-bar-container">
      <div className="cooldown-bar-label">Coletando...</div>
      <div className="cooldown-bar-track">
        <div
          className="cooldown-bar-fill"
          style={{
            width: `${progress}%`,
            transition: isAnimating ? "none" : "width 0.1s ease-out",
          }}
        />
      </div>
      <div className="cooldown-bar-time">{(progress / 100).toFixed(1)}s</div>
    </div>
  );
}