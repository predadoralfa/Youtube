import { useEffect } from "react";
import { readEntityStatus, readEntityVitals } from "../helpers";

export function useSelfHud(state, worldStoreRef) {
  useEffect(() => {
    const store = worldStoreRef?.current ?? null;
    if (!store?.subscribe) return undefined;

    return store.subscribe(() => {
      const selfId = store?.selfId ? String(store.selfId) : null;
      if (!selfId) return state.setSelfHpBar(null);

      const self = store.entities.get(selfId) ?? null;
      if (!self) return state.setSelfHpBar(null);

      const vitals = readEntityVitals(self);
      const status = readEntityStatus(self);
      state.setSelfHpBar({
        hpCurrent: vitals.hpCurrent,
        hpMax: vitals.hpMax,
        staminaCurrent: vitals.staminaCurrent,
        staminaMax: vitals.staminaMax,
        hungerCurrent: vitals.hungerCurrent,
        hungerMax: vitals.hungerMax,
        thirstCurrent: vitals.thirstCurrent,
        thirstMax: vitals.thirstMax,
        immunityCurrent: status.immunityCurrent,
        immunityMax: status.immunityMax,
        feverCurrent: status.feverCurrent,
        feverMax: status.feverMax,
        feverPercent: status.feverPercent,
        feverActive: status.feverActive,
        sleepCurrent: status.sleepCurrent,
        sleepMax: status.sleepMax,
      });
    });
  }, [state, worldStoreRef]);
}
