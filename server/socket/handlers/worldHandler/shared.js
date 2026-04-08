"use strict";

function emitBaseline(socket, baseline) {
  socket.emit("world:baseline", {
    ok: true,
    ...baseline,
    t: Date.now(),
  });
}

function ackOk(ack, rt, baseline) {
  if (typeof ack !== "function") return;
  ack({
    ok: true,
    instanceId: String(rt.instanceId),
    youId: String(rt.userId),
    cx: baseline.chunk.cx,
    cz: baseline.chunk.cz,
  });
}

function ackErr(ack, err) {
  if (typeof ack !== "function") return;
  ack({ ok: false, error: String(err?.message || err) });
}

function logWorld(message, data) {
  console.log(`[WORLD] ${message}`, data || {});
}

module.exports = {
  emitBaseline,
  ackOk,
  ackErr,
  logWorld,
};
