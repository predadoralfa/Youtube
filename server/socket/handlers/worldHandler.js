const { handleWorldJoin } = require("./world/join");
const { handleWorldResync } = require("./world/resync");

// ✅ INVENTORY
const { buildInventoryFull } = require("../../state/inventory/fullPayload");

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

async function emitInventoryFull(socket) {
  const userId = socket.data.userId;
  if (!userId) return;
  const inv = await buildInventoryFull(userId);
  socket.emit("inv:full", inv);
}

function registerWorldHandler(io, socket) {
  socket.on("world:join", async (_payload, ack) => {
    try {
      const { rt, baseline } = await handleWorldJoin({ socket });
      emitBaseline(socket, baseline);

      // ✅ inv privado do self (resync "grátis")
      await emitInventoryFull(socket);

      ackOk(ack, rt, baseline);
    } catch (err) {
      ackErr(ack, err);
    }
  });

  socket.on("world:resync", async (_payload, ack) => {
    try {
      const { rt, baseline } = await handleWorldResync({ socket });
      emitBaseline(socket, baseline);

      // ✅ inv privado do self (resync "grátis")
      await emitInventoryFull(socket);

      ackOk(ack, rt, baseline);
    } catch (err) {
      ackErr(ack, err);
    }
  });
}

module.exports = { registerWorldHandler };