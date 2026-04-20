// server/state/movement/entity.js

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function readHpCurrent(rt) {
  return toNum(
    rt?.hpCurrent ??
      rt?.hp_current ??
      rt?.hp ??
      rt?.stats?.hpCurrent ??
      rt?.stats?.hp_current,
    100
  );
}

function readHpMax(rt) {
  return toNum(
    rt?.hpMax ??
      rt?.hp_max ??
      rt?.stats?.hpMax ??
      rt?.stats?.hp_max,
    100
  );
}

function readStaminaCurrent(rt) {
  return toNum(
    rt?.staminaCurrent ??
      rt?.stamina_current ??
      rt?.stats?.staminaCurrent ??
      rt?.stats?.stamina_current,
    0
  );
}

function readStaminaMax(rt) {
  return toNum(
    rt?.staminaMax ??
      rt?.stamina_max ??
      rt?.stats?.staminaMax ??
      rt?.stats?.stamina_max,
    0
  );
}

function readHungerCurrent(rt) {
  return toNum(
    rt?.hungerCurrent ??
      rt?.hunger_current ??
      rt?.stats?.hungerCurrent ??
      rt?.stats?.hunger_current,
    0
  );
}

function readHungerMax(rt) {
  return toNum(
    rt?.hungerMax ??
      rt?.hunger_max ??
      rt?.stats?.hungerMax ??
      rt?.stats?.hunger_max,
    0
  );
}

function readThirstCurrent(rt) {
  return toNum(
    rt?.thirstCurrent ??
      rt?.thirst_current ??
      rt?.stats?.thirstCurrent ??
      rt?.stats?.thirst_current,
    0
  );
}

function readThirstMax(rt) {
  return toNum(
    rt?.thirstMax ??
      rt?.thirst_max ??
      rt?.stats?.thirstMax ??
      rt?.stats?.thirst_max,
    0
  );
}

function readImmunityCurrent(rt) {
  return toNum(
    rt?.immunityCurrent ??
      rt?.immunity_current ??
      rt?.status?.immunity?.current ??
      rt?.stats?.immunityCurrent ??
      rt?.stats?.immunity_current,
    100
  );
}

function readImmunityMax(rt) {
  return toNum(
    rt?.immunityMax ??
      rt?.immunity_max ??
      rt?.status?.immunity?.max ??
      rt?.stats?.immunityMax ??
      rt?.stats?.immunity_max,
    100
  );
}

function readDiseaseLevel(rt) {
  return toNum(
    rt?.diseaseLevel ??
      rt?.disease_level ??
      rt?.status?.disease?.level ??
      rt?.stats?.diseaseLevel ??
      rt?.stats?.disease_level,
    0
  );
}

function readDiseaseSeverity(rt) {
  return toNum(
    rt?.diseaseSeverity ??
      rt?.disease_severity ??
      rt?.status?.disease?.severity ??
      rt?.stats?.diseaseSeverity ??
      rt?.stats?.disease_severity,
    0
  );
}

function readSleepCurrent(rt) {
  return toNum(
    rt?.sleepCurrent ??
      rt?.sleep_current ??
      rt?.status?.sleep?.current ??
      rt?.stats?.sleepCurrent ??
      rt?.stats?.sleep_current,
    100
  );
}

function readSleepMax(rt) {
  return toNum(
    rt?.sleepMax ??
      rt?.sleep_max ??
      rt?.status?.sleep?.max ??
      rt?.stats?.sleepMax ??
      rt?.stats?.sleep_max,
      100
  );
}

function readFeverDebuffs(rt) {
  const feverCurrent = readDiseaseLevel(rt);
  const feverSeverity = readDiseaseSeverity(rt);
  const severity = feverCurrent >= 100 ? 0 : Math.max(0, Math.min(1, feverSeverity || 1 - feverCurrent / 100));
  const tier = feverCurrent >= 100 ? 0 : Math.max(1, Math.min(10, Math.ceil(severity * 10)));
  const tempoMultiplier =
    tier <= 0 ? 1 : tier <= 5 ? 1 + tier * 0.1 : 1 + 5 * 0.1 + (tier - 5) * 0.15;
  return {
    active: tier > 0,
    tier,
    tempoMultiplier,
    staminaRegenMultiplier: tier > 0 ? 1 / tempoMultiplier : 1,
  };
}

function bumpRev(rt) {
  const cur = Number(rt.rev ?? 0);
  rt.rev = Number.isFinite(cur) ? cur + 1 : 1;
}

function toEntity(rt) {
  const hpCurrent = readHpCurrent(rt);
  const hpMax = readHpMax(rt);
  const staminaCurrent = readStaminaCurrent(rt);
  const staminaMax = readStaminaMax(rt);
  const hungerCurrent = readHungerCurrent(rt);
  const hungerMax = readHungerMax(rt);
  const thirstCurrent = readThirstCurrent(rt);
  const thirstMax = readThirstMax(rt);
  const immunityCurrent = readImmunityCurrent(rt);
  const immunityMax = readImmunityMax(rt);
  const diseaseLevel = readDiseaseLevel(rt);
  const diseaseSeverity = readDiseaseSeverity(rt);
  const sleepCurrent = readSleepCurrent(rt);
  const sleepMax = readSleepMax(rt);
  const debuffs = readFeverDebuffs(rt);

  return {
    entityId: String(rt.userId),
    kind: "PLAYER",
    displayName: rt.displayName ?? null,
    pos: rt.pos,
    yaw: rt.yaw,
    hp: hpCurrent, // compat legado
    action: rt.action ?? "idle",
    rev: rt.rev ?? 0,
    buildLock: rt.buildLock ?? null,
    sleepLock: rt.sleepLock ?? null,

    vitals: {
      hp: {
        current: hpCurrent,
        max: hpMax,
      },
      stamina: {
        current: staminaCurrent,
        max: staminaMax,
      },
      hunger: {
        current: hungerCurrent,
        max: hungerMax,
      },
      thirst: {
        current: thirstCurrent,
        max: thirstMax,
      },
    },
    status: {
      immunity: {
        current: immunityCurrent,
        max: immunityMax,
      },
      fever: {
        current: diseaseLevel,
        severity: diseaseSeverity,
      },
      debuffs,
      sleep: {
        current: sleepCurrent,
        max: sleepMax,
      },
    },
  };
}

function toDelta(rt) {
  const hpCurrent = readHpCurrent(rt);
  const hpMax = readHpMax(rt);
  const staminaCurrent = readStaminaCurrent(rt);
  const staminaMax = readStaminaMax(rt);
  const hungerCurrent = readHungerCurrent(rt);
  const hungerMax = readHungerMax(rt);
  const thirstCurrent = readThirstCurrent(rt);
  const thirstMax = readThirstMax(rt);
  const immunityCurrent = readImmunityCurrent(rt);
  const immunityMax = readImmunityMax(rt);
  const diseaseLevel = readDiseaseLevel(rt);
  const diseaseSeverity = readDiseaseSeverity(rt);
  const sleepCurrent = readSleepCurrent(rt);
  const sleepMax = readSleepMax(rt);
  const debuffs = readFeverDebuffs(rt);

  return {
    entityId: String(rt.userId),
    kind: "PLAYER",
    pos: rt.pos,
    yaw: rt.yaw,
    hp: hpCurrent, // compat legado
    action: rt.action ?? "idle",
    rev: rt.rev ?? 0,
    buildLock: rt.buildLock ?? null,
    sleepLock: rt.sleepLock ?? null,

    vitals: {
      hp: {
        current: hpCurrent,
        max: hpMax,
      },
      stamina: {
        current: staminaCurrent,
        max: staminaMax,
      },
      hunger: {
        current: hungerCurrent,
        max: hungerMax,
      },
      thirst: {
        current: thirstCurrent,
        max: thirstMax,
      },
    },
    status: {
      immunity: {
        current: immunityCurrent,
        max: immunityMax,
      },
      fever: {
        current: diseaseLevel,
        severity: diseaseSeverity,
      },
      debuffs,
      sleep: {
        current: sleepCurrent,
        max: sleepMax,
      },
    },
  };
}

module.exports = {
  bumpRev,
  toEntity,
  toDelta,
};
