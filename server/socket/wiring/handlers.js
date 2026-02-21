// server/socket/wiring/handlers.js

const { registerMoveHandler } = require("../handlers/moveHandler");
const { registerWorldHandler } = require("../handlers/worldHandler");
const { registerClickMoveHandler } = require("../handlers/clickMoveHandler");

function registerGameHandlers(io, socket) {
  registerMoveHandler(socket);
  registerClickMoveHandler(socket);
  registerWorldHandler(io, socket);
}

module.exports = {
  registerGameHandlers,
};