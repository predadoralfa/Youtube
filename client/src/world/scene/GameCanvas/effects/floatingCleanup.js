import { useEffect } from "react";

export function useFloatingCleanup(state, damageTtlMs) {
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      state.setFloatingDamages((prev) => {
        if (!prev || prev.length === 0) return prev;

        let changed = false;
        const alive = [];
        const removedIds = [];

        for (const damage of prev) {
          const startedAt = Number(damage?.startedAt ?? 0);
          const ttlMs = Number(damage?.ttlMs ?? damageTtlMs);
          if (startedAt > 0 && now - startedAt < ttlMs) {
            alive.push(damage);
          } else {
            changed = true;
            removedIds.push(damage?.id);
          }
        }

        if (!changed) return prev;
        for (const id of removedIds) {
          if (id != null) state.seenDamageEventIdsRef.current.delete(String(id));
        }
        return alive;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [state, damageTtlMs]);
}
