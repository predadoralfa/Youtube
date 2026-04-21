"use strict";

const { handleWorldJoin } = require("../world/join");
const { handleWorldResync } = require("../world/resync");
const { emitBaseline, ackOk, ackErr } = require("./shared");
const { emitInventoryFull, emitResearchFull } = require("./privatePayloads");

function registerWorldHandler(io, socket) {
  socket.on("world:join", async (_payload, ack) => {
    try {
      const { rt, baseline } = await handleWorldJoin({ socket });
      emitBaseline(socket, baseline);
      await emitInventoryFull(socket);
      await emitResearchFull(socket);
      ackOk(ack, rt, baseline);
    } catch (err) {
      ackErr(ack, err);
    }
  });

  socket.on("world:resync", async (_payload, ack) => {
    try {
      const { rt, baseline } = await handleWorldResync({ socket });
      emitBaseline(socket, baseline);
      await emitInventoryFull(socket);
      await emitResearchFull(socket);
      ackOk(ack, rt, baseline);
    } catch (err) {
      ackErr(ack, err);
    }
  });
}

module.exports = {
  registerWorldHandler,
};
