"use strict";

const { registerEquipmentEvents } = require("./events");

function registerEquipmentHandler(io, socket) {
  registerEquipmentEvents(socket);
}

module.exports = {
  registerEquipmentHandler,
};
