"use strict";

const { handleWorldJoin } = require("../world/join");
const { handleWorldResync } = require("../world/resync");
const { emitBaseline, ackOk, ackErr, logWorld } = require("./shared");
const { emitInventoryFull, emitResearchFull } = require("./privatePayloads");

function registerWorldHandler(io, socket) {
  socket.on("world:join", async (_payload, ack) => {
    try {
      logWorld("world:join received", { socketId: socket.id, userId: socket.data.userId ?? null });
      const { rt, baseline } = await handleWorldJoin({ socket });
      emitBaseline(socket, baseline);
      await emitInventoryFull(socket);
      await emitResearchFull(socket);
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
      logWorld("world:resync received", {
        socketId: socket.id,
        userId: socket.data.userId ?? null,
      });
      const { rt, baseline } = await handleWorldResync({ socket });
      emitBaseline(socket, baseline);
      await emitInventoryFull(socket);
      await emitResearchFull(socket);
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

module.exports = {
  registerWorldHandler,
};
