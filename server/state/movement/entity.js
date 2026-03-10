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

function bumpRev(rt) {
  const cur = Number(rt.rev ?? 0);
  rt.rev = Number.isFinite(cur) ? cur + 1 : 1;
}

function toEntity(rt) {
  const hpCurrent = readHpCurrent(rt);
  const hpMax = readHpMax(rt);
  const staminaCurrent = readStaminaCurrent(rt);
  const staminaMax = readStaminaMax(rt);

  return {
    entityId: String(rt.userId),
    kind: "PLAYER",
    displayName: rt.displayName ?? null,
    pos: rt.pos,
    yaw: rt.yaw,
    hp: hpCurrent, // compat legado
    action: rt.action ?? "idle",
    rev: rt.rev ?? 0,

    vitals: {
      hp: {
        current: hpCurrent,
        max: hpMax,
      },
      stamina: {
        current: staminaCurrent,
        max: staminaMax,
      },
    },
  };
}

function toDelta(rt) {
  const hpCurrent = readHpCurrent(rt);
  const hpMax = readHpMax(rt);
  const staminaCurrent = readStaminaCurrent(rt);
  const staminaMax = readStaminaMax(rt);

  return {
    entityId: String(rt.userId),
    kind: "PLAYER",
    pos: rt.pos,
    yaw: rt.yaw,
    hp: hpCurrent, // compat legado
    action: rt.action ?? "idle",
    rev: rt.rev ?? 0,

    vitals: {
      hp: {
        current: hpCurrent,
        max: hpMax,
      },
      stamina: {
        current: staminaCurrent,
        max: staminaMax,
      },
    },
  };
}

module.exports = {
  bumpRev,
  toEntity,
  toDelta,
};