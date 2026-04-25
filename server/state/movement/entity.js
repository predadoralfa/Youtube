// server/state/movement/entity.js

const { resolveFeverDebuffProfile } = require("../conditions/fever");

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

function readImmunityPercent(rt) {
  return toNum(
    rt?.immunityPercent ??
      rt?.immunity_percent ??
      rt?.status?.immunity?.percent ??
      rt?.stats?.immunityPercent ??
      rt?.stats?.immunity_percent,
    Math.round((readImmunityCurrent(rt) / Math.max(1, readImmunityMax(rt))) * 100000) / 1000
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

function readDiseasePercent(rt) {
  return toNum(
    rt?.diseasePercent ??
      rt?.disease_percent ??
      rt?.status?.fever?.percent ??
      rt?.status?.disease?.percent ??
      rt?.stats?.diseasePercent ??
      rt?.stats?.disease_percent,
    Math.round((Math.min(readDiseaseLevel(rt), 100) / 100) * 100000) / 1000
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
  return resolveFeverDebuffProfile(feverCurrent, feverSeverity);
}

function bumpRev(rt) {
  const cur = Number(rt.rev ?? 0);
  rt.rev = Number.isFinite(cur) ? cur + 1 : 1;
}

function buildMovementSnapshot(rt) {
  const input = rt?.movementInput ?? null;
  const mode = String(input?.mode ?? "STOP").toUpperCase();
  const dir = input?.dir ?? { x: 0, z: 0 };
  const target = input?.target ?? null;
  const stopRadius = Number(input?.stopRadius ?? 0.75);
  const updatedAtMs = Number(input?.updatedAtMs ?? 0);
  const effectiveMoveSpeed = Number(rt?.effectiveMoveSpeed ?? rt?.speed ?? 0);
  const speed = Number(rt?.speed ?? 0);

  return {
    mode,
    dir: {
      x: Number(dir?.x ?? 0),
      z: Number(dir?.z ?? 0),
    },
    target: target
      ? {
          x: Number(target.x ?? 0),
          z: Number(target.z ?? 0),
        }
      : null,
    stopRadius: Number.isFinite(stopRadius) && stopRadius > 0 ? stopRadius : 0.75,
    updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : 0,
    speed: Number.isFinite(speed) && speed > 0 ? speed : null,
    effectiveMoveSpeed:
      Number.isFinite(effectiveMoveSpeed) && effectiveMoveSpeed > 0 ? effectiveMoveSpeed : null,
  };
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
  const immunityPercent = readImmunityPercent(rt);
  const diseaseLevel = readDiseaseLevel(rt);
  const diseaseSeverity = readDiseaseSeverity(rt);
  const diseasePercent = readDiseasePercent(rt);
  const sleepCurrent = readSleepCurrent(rt);
  const sleepMax = readSleepMax(rt);
  const debuffs = readFeverDebuffs(rt);

  return {
    entityId: String(rt.userId),
    kind: "PLAYER",
    displayName: rt.displayName ?? null,
    pos: rt.pos,
    yaw: rt.yaw,
    movement: buildMovementSnapshot(rt),
    hp: hpCurrent, // compat legado
    action: rt.action ?? "idle",
    rev: rt.rev ?? 0,
    buildLock: rt.buildLock ?? null,
    sleepLock: rt.sleepLock ?? null,
    interact: rt.interact
      ? {
          active: Boolean(rt.interact.active),
          kind: String(rt.interact.kind ?? ""),
          id: rt.interact.id != null ? String(rt.interact.id) : null,
          stopRadius: Number(rt.interact.stopRadius ?? 0),
          startedAtMs: Number(rt.interact.startedAtMs ?? 0),
          timeoutMs: Number(rt.interact.timeoutMs ?? 0),
          phase: String(rt.interact.phase ?? "APPROACH"),
          collectStartedAtMs: Number(rt.interact.collectStartedAtMs ?? 0),
        }
      : null,

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
        percent: immunityPercent,
      },
      fever: {
        current: diseaseLevel,
        max: 100,
        percent: diseasePercent,
        severity: diseaseSeverity,
        active: diseaseLevel > 0,
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
  const immunityPercent = readImmunityPercent(rt);
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
    movement: buildMovementSnapshot(rt),
    hp: hpCurrent, // compat legado
    action: rt.action ?? "idle",
    rev: rt.rev ?? 0,
    buildLock: rt.buildLock ?? null,
    sleepLock: rt.sleepLock ?? null,
    interact: rt.interact
      ? {
          active: Boolean(rt.interact.active),
          kind: String(rt.interact.kind ?? ""),
          id: rt.interact.id != null ? String(rt.interact.id) : null,
          stopRadius: Number(rt.interact.stopRadius ?? 0),
          startedAtMs: Number(rt.interact.startedAtMs ?? 0),
          timeoutMs: Number(rt.interact.timeoutMs ?? 0),
          phase: String(rt.interact.phase ?? "APPROACH"),
          collectStartedAtMs: Number(rt.interact.collectStartedAtMs ?? 0),
        }
      : null,

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
        percent: immunityPercent,
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
