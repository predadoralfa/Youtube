const { handleWorldJoin } = require("./world/join");
const { handleWorldResync } = require("./world/resync");

// ✅ INVENTORY
const { ensureInventoryLoaded } = require("../../state/inventory/loader");
const { ensureEquipmentLoaded } = require("../../state/equipment/loader");
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

function logWorld(message, data) {
  console.log(`[WORLD] ${message}`, data || {});
}

async function emitInventoryFull(socket) {
  const userId = socket.data.userId;
  if (!userId) return;
  const invRt = await ensureInventoryLoaded(userId);
  const eqRt = await ensureEquipmentLoaded(userId);
  const inv = buildInventoryFull(invRt, eqRt);
  socket.emit("inv:full", inv);
  logWorld("emitInventoryFull", {
    userId,
    socketId: socket.id,
    heldState: invRt?.heldState ? {
      mode: invRt.heldState.mode ?? null,
      containerId: invRt.heldState.sourceContainerId ?? null,
      slotIndex: invRt.heldState.sourceSlotIndex ?? null,
      qty: invRt.heldState.qty ?? null,
    } : null,
    containers: invRt?.containers?.length ?? 0,
  });
}

function registerWorldHandler(io, socket) {
  socket.on("world:join", async (_payload, ack) => {
    try {
      logWorld("world:join received", { socketId: socket.id, userId: socket.data.userId ?? null });
      const { rt, baseline } = await handleWorldJoin({ socket });
      emitBaseline(socket, baseline);

      // ✅ inv privado do self (resync "grátis")
      await emitInventoryFull(socket);

      logWorld("world:join ok", {
        socketId: socket.id,
        userId: rt?.userId ?? socket.data.userId ?? null,
        instanceId: rt?.instanceId ?? null,
      });
      ackOk(ack, rt, baseline);
    } catch (err) {
      logWorld("world:join failed", {
        socketId: socket.id,
        userId: socket.data.userId ?? null,
        error: String(err?.message || err),
      });
      ackErr(ack, err);
    }
  });

  socket.on("world:resync", async (_payload, ack) => {
    try {
      logWorld("world:resync received", { socketId: socket.id, userId: socket.data.userId ?? null });
      const { rt, baseline } = await handleWorldResync({ socket });
      emitBaseline(socket, baseline);

      // ✅ inv privado do self (resync "grátis")
      await emitInventoryFull(socket);

      logWorld("world:resync ok", {
        socketId: socket.id,
        userId: rt?.userId ?? socket.data.userId ?? null,
        instanceId: rt?.instanceId ?? null,
      });
      ackOk(ack, rt, baseline);
    } catch (err) {
      logWorld("world:resync failed", {
        socketId: socket.id,
        userId: socket.data.userId ?? null,
        error: String(err?.message || err),
      });
      ackErr(ack, err);
    }
  });
}

module.exports = { registerWorldHandler };
