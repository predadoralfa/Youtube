// server/socket/wiring/handlers.js

const { registerMoveHandler } = require("../handlers/moveHandler");
const { registerWorldHandler } = require("../handlers/worldHandler");
const { registerClickMoveHandler } = require("../handlers/clickMoveHandler");
const { registerInventoryHandler } = require("../handlers/inventoryHandler"); // ✅ NOVO

function registerGameHandlers(io, socket) {
  // Movimento WASD
  registerMoveHandler(socket);

  // Click-to-move
  registerClickMoveHandler(socket);

  // Mundo (join/resync/baseline)
  registerWorldHandler(io, socket);

  // ✅ Inventário (privado, autoritativo)
  registerInventoryHandler(io, socket);
}

module.exports = {
  registerGameHandlers,
};