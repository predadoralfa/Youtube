import { normalizeVitals } from "../../../helpers";

export function patchEnemyAttack(prev, payload) {
  if (!prev?.runtime) return prev;

  const currentVitals = prev.runtime.vitals ?? normalizeVitals(prev.runtime);
  const hpCurrentRaw = payload?.targetHPAfter ?? payload?.hpAfter ?? payload?.damageAfter;
  const hpMaxRaw = payload?.targetHPMax ?? payload?.hpMax;
  const hpCurrent = Number.isFinite(Number(hpCurrentRaw))
    ? Math.max(0, Number(hpCurrentRaw))
    : currentVitals?.hp?.current ?? 0;
  const hpMax = Number.isFinite(Number(hpMaxRaw))
    ? Math.max(0, Number(hpMaxRaw))
    : currentVitals?.hp?.max ?? 0;

  const selfVitals = {
    hp: { current: hpCurrent, max: hpMax },
    stamina: currentVitals?.stamina ?? { current: 0, max: 0 },
    hunger: currentVitals?.hunger ?? { current: 0, max: 0 },
  };

  return {
    ...prev,
    runtime: {
      ...prev.runtime,
      vitals: selfVitals,
    },
    ui: {
      ...(prev.ui ?? {}),
      self: {
        ...((prev.ui && prev.ui.self) ?? {}),
        vitals: selfVitals,
      },
    },
  };
}
