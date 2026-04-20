"use strict";

const { registerRequestFull } = require("./events/full");
const { registerMutationEvents } = require("./events/mutations");
const { registerSplitEvent } = require("./events/split");
const { registerDropEvent } = require("./events/drop");
const { registerAutoFoodEvent } = require("./events/autoFood");
const { registerConsumeEvent } = require("./events/consume");
const { registerMedicalEvent } = require("./events/medical");
const { registerCraftEvent } = require("./events/craft");

function registerInventoryHandler(io, socket) {
  registerRequestFull(socket);
  registerMutationEvents(socket);
  registerSplitEvent(socket);
  registerDropEvent(socket);
  registerAutoFoodEvent(socket);
  registerConsumeEvent(socket);
  registerMedicalEvent(socket);
  registerCraftEvent(socket);
}

module.exports = {
  registerInventoryHandler,
};
