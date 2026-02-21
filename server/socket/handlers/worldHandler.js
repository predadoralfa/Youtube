// server/socket/handlers/worldHandler.js
//
// Responsável por:
// - world:join
// - world:resync
// - baseline autoritativo
// - cálculo de interest (chunk rooms)
// - join/leave de rooms
//
// Regras:
// - Cliente não escolhe chunk nem entidade
// - Sempre existe baseline
// - Não tocar DB no hot path para terceiros (apenas self pode ensureRuntimeLoaded)
// - NÃO deve reintroduzir OFFLINE no mundo

const { handleWorldJoin } = require("./world/join");
const { handleWorldResync } = require("./world/resync");

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

function registerWorldHandler(io, socket) {
  socket.on("world:join", async (_payload, ack) => {
    try {
      const { rt, baseline } = await handleWorldJoin({ socket });
      emitBaseline(socket, baseline);
      ackOk(ack, rt, baseline);
    } catch (err) {
      ackErr(ack, err);
    }
  });

  socket.on("world:resync", async (_payload, ack) => {
    try {
      const { rt, baseline } = await handleWorldResync({ socket });
      emitBaseline(socket, baseline);
      ackOk(ack, rt, baseline);
    } catch (err) {
      ackErr(ack, err);
    }
  });
}

module.exports = { registerWorldHandler };