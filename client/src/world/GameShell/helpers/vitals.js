import { toDisplayInt } from "./numbers";

export function normalizeVitals(raw) {
  const hpCurrent = raw?.vitals?.hp?.current ?? raw?.hpCurrent ?? raw?.hp_current ?? raw?.hp ?? 0;
  const hpMax = raw?.vitals?.hp?.max ?? raw?.hpMax ?? raw?.hp_max ?? 0;
  const staminaCurrent =
    raw?.vitals?.stamina?.current ?? raw?.staminaCurrent ?? raw?.stamina_current ?? 0;
  const staminaMax = raw?.vitals?.stamina?.max ?? raw?.staminaMax ?? raw?.stamina_max ?? 0;
  const hungerCurrent =
    raw?.vitals?.hunger?.current ?? raw?.hungerCurrent ?? raw?.hunger_current ?? 0;
  const hungerMax = raw?.vitals?.hunger?.max ?? raw?.hungerMax ?? raw?.hunger_max ?? 0;

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

export function pickBestSelfVitals(snapshot, selfEntity) {
  if (snapshot?.runtime?.vitals) return normalizeVitals(snapshot.runtime);
  if (selfEntity?.vitals) return normalizeVitals(selfEntity);
  if (snapshot?.ui?.self?.vitals) return normalizeVitals(snapshot.ui.self);

  return {
    hp: { current: 0, max: 0 },
    stamina: { current: 0, max: 0 },
    hunger: { current: 0, max: 0 },
  };
}
