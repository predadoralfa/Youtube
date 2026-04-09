import { useDamageSocket } from "./damageSocket";
import { useFloatingCleanup } from "./floatingCleanup";
import { useSelfHud } from "./selfHud";

export function useCombatEffects(state, worldStoreRef) {
  const damageTtlMs = 1200;
  useDamageSocket(state, damageTtlMs);
  useSelfHud(state, worldStoreRef);
  useFloatingCleanup(state, damageTtlMs);
}
