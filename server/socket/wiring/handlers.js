// server/socket/wiring/handlers.js

const { registerMoveHandler } = require("../handlers/moveHandler");
const { registerWorldHandler } = require("../handlers/worldHandler");
const { registerClickMoveHandler } = require("../handlers/clickMoveHandler");
const { registerInventoryHandler } = require("../handlers/inventoryHandler");
const { registerEquipmentHandler } = require("../handlers/equipmentHandler");
const { registerResearchHandler } = require("../handlers/researchHandler");

// ✅ NOVO: aproximação/interação (space hold)
const { registerInteractHandler } = require("../handlers/interactHandler");

function registerGameHandlers(io, socket) {
  // Movimento WASD
  registerMoveHandler(socket);

  // Click-to-move
  registerClickMoveHandler(socket);

  // ✅ SPACE hold -> approach target (PLAYER/ACTOR) usando motor CLICK
  registerInteractHandler(io, socket);

  // Mundo (join/resync/baseline)
  registerWorldHandler(io, socket);

  // Inventário (privado, autoritativo)
  registerInventoryHandler(io, socket);

  // Equipment corporal simples
  registerEquipmentHandler(io, socket);

  // Research / estudos
  registerResearchHandler(io, socket);
}

module.exports = {
  registerGameHandlers,
};
