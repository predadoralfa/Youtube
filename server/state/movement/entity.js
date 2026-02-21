// server/state/movement/entity.js

function bumpRev(rt) {
  const cur = Number(rt.rev ?? 0);
  rt.rev = Number.isFinite(cur) ? cur + 1 : 1;
}

function toEntity(rt) {
  return {
    entityId: String(rt.userId),
    displayName: rt.displayName ?? null,
    pos: rt.pos,
    yaw: rt.yaw,
    hp: rt.hp ?? 100,
    action: rt.action ?? "idle",
    rev: rt.rev ?? 0,
  };
}

function toDelta(rt) {
  return {
    entityId: String(rt.userId),
    pos: rt.pos,
    yaw: rt.yaw,
    hp: rt.hp ?? 100,
    action: rt.action ?? "idle",
    rev: rt.rev ?? 0,
  };
}

module.exports = {
  bumpRev,
  toEntity,
  toDelta,
};

