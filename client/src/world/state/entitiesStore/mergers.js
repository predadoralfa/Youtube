import { toDisplayInt } from "./normalizers";

export function mergePos(oldPos, newPos) {
  return {
    x: newPos?.x != null ? Number(newPos.x) : (oldPos?.x ?? 0),
    y: newPos?.y != null ? Number(newPos.y) : (oldPos?.y ?? undefined),
    z: newPos?.z != null ? Number(newPos.z) : (oldPos?.z ?? 0),
  };
}

export function mergeVitals(baseVitals, rawDelta, nextHpCompat) {
  const current = baseVitals ?? {
    hp: { current: 0, max: 0 },
    stamina: { current: 0, max: 0 },
    hunger: { current: 0, max: 0 },
  };

  const deltaVitals = rawDelta?.vitals ?? null;
  const stats = rawDelta?.stats ?? null;

  const hpCurrent =
    deltaVitals?.hp?.current ??
    rawDelta?.hp ??
    rawDelta?.hpCurrent ??
    rawDelta?.hp_current ??
    stats?.hpCurrent ??
    stats?.hp_current ??
    nextHpCompat ??
    current.hp.current;

  const hpMax =
    deltaVitals?.hp?.max ??
    rawDelta?.hpMax ??
    rawDelta?.hp_max ??
    stats?.hpMax ??
    stats?.hp_max ??
    current.hp.max;

  const staminaCurrent =
    deltaVitals?.stamina?.current ??
    rawDelta?.staminaCurrent ??
    rawDelta?.stamina_current ??
    stats?.staminaCurrent ??
    stats?.stamina_current ??
    current.stamina.current;

  const staminaMax =
    deltaVitals?.stamina?.max ??
    rawDelta?.staminaMax ??
    rawDelta?.stamina_max ??
    stats?.staminaMax ??
    stats?.stamina_max ??
    current.stamina.max;

  const hungerCurrent =
    deltaVitals?.hunger?.current ??
    rawDelta?.hungerCurrent ??
    rawDelta?.hunger_current ??
    stats?.hungerCurrent ??
    stats?.hunger_current ??
    current.hunger.current;

  const hungerMax =
    deltaVitals?.hunger?.max ??
    rawDelta?.hungerMax ??
    rawDelta?.hunger_max ??
    stats?.hungerMax ??
    stats?.hunger_max ??
    current.hunger.max;

  return {
    hp: {
      current: toDisplayInt(hpCurrent, 0),
      max: toDisplayInt(hpMax, 0),
    },
    stamina: {
      current: toDisplayInt(staminaCurrent, 0),
      max: toDisplayInt(staminaMax, 0),
    },
    hunger: {
      current: toDisplayInt(hungerCurrent, 0),
      max: toDisplayInt(hungerMax, 0),
    },
  };
}
