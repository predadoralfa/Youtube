"use strict";

const { getActiveSocket } = require("../../../../socket/sessionIndex");
const { computeChunkFromPos } = require("../../../presenceIndex");
const { toDelta } = require("../../entity");
const { emitDeltaToInterest } = require("../../emit");

function emitSelfVitals(socket, rt, delta) {
  if (!socket) return;

  socket.emit("self:vitals", {
    entityId: String(rt.userId),
    rev: rt.rev ?? 0,
    vitals: delta?.vitals ?? null,
    status: delta?.status ?? null,
  });
}

async function emitPlayerState(io, rt, options = {}) {
  const socket = getActiveSocket(rt.userId);
  const delta = toDelta(rt);
  const includeInterest = options.includeInterest !== false;
  const includeSelf = options.includeSelf !== false;
  const nowMs = Number(options.nowMs ?? Date.now());

  if (includeInterest) {
    emitDeltaToInterest(io, socket, rt.userId, delta);
  }

  if (socket) {
    if (includeSelf) {
      socket.emit("move:state", {
        entityId: String(rt.userId),
        speed: rt.speed ?? null,
        effectiveMoveSpeed: rt.effectiveMoveSpeed ?? rt.speed ?? null,
        movement: delta.movement ?? null,
        interact: delta.interact ?? null,
        pos: rt.pos,
        yaw: rt.yaw,
        rev: rt.rev ?? 0,
        action: rt.action ?? "idle",
        cameraPitch: rt.cameraPitch ?? null,
        cameraDistance: rt.cameraDistance ?? null,
        buildLock: rt.buildLock ?? null,
        sleepLock: rt.sleepLock ?? null,
        chunk: rt.chunk ?? computeChunkFromPos(rt.pos),
      });
    }
  }

}

module.exports = {
  emitPlayerState,
  emitSelfVitals,
};
