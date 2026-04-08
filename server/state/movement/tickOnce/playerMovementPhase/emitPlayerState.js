"use strict";

const { getActiveSocket } = require("../../../../socket/sessionIndex");
const { computeChunkFromPos } = require("../../../presenceIndex");
const { toDelta } = require("../../entity");
const { emitDeltaToInterest } = require("../../emit");

async function emitPlayerState(io, rt) {
  const socket = getActiveSocket(rt.userId);
  const delta = toDelta(rt);
  emitDeltaToInterest(io, socket, rt.userId, delta);
  if (socket) {
    socket.emit("move:state", {
      entityId: String(rt.userId),
      pos: rt.pos,
      yaw: rt.yaw,
      rev: rt.rev ?? 0,
      vitals: delta.vitals,
      chunk: rt.chunk ?? computeChunkFromPos(rt.pos),
    });
  }
}

module.exports = {
  emitPlayerState,
};
