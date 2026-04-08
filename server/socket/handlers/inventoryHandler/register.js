"use strict";

const { registerRequestFull } = require("./events/full");
const { registerMutationEvents } = require("./events/mutations");
const { registerSplitEvent } = require("./events/split");
const { registerDropEvent } = require("./events/drop");
const { registerAutoFoodEvent } = require("./events/autoFood");

function registerInventoryHandler(io, socket) {
  registerRequestFull(socket);
  registerMutationEvents(socket);
  registerSplitEvent(socket);
  registerDropEvent(socket);
  registerAutoFoodEvent(socket);
}

module.exports = {
  registerInventoryHandler,
};
