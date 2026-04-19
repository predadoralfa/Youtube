import { useEffect } from "react";
import { readEntityVitals } from "../helpers";

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
      state.setSelfHpBar({
        hpCurrent: vitals.hpCurrent,
        hpMax: vitals.hpMax,
        staminaCurrent: vitals.staminaCurrent,
        staminaMax: vitals.staminaMax,
        hungerCurrent: vitals.hungerCurrent,
        hungerMax: vitals.hungerMax,
        thirstCurrent: vitals.thirstCurrent,
        thirstMax: vitals.thirstMax,
      });
    });
  }, [state, worldStoreRef]);
}
