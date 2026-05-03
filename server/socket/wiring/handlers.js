// server/socket/wiring/handlers.js

const { registerMoveHandler } = require("../handlers/moveHandler");
const { registerWorldHandler } = require("../handlers/worldHandler");
const { registerClickMoveHandler } = require("../handlers/clickMoveHandler");
const { registerInventoryHandler } = require("../handlers/inventoryHandler");
const { registerEquipmentHandler } = require("../handlers/equipmentHandler");
const { registerResearchHandler } = require("../handlers/researchHandler");
const { registerBuildHandler } = require("../handlers/buildHandler/register");
const { registerSleepHandler } = require("../handlers/sleepHandler/register");
const { registerActorHandler } = require("../handlers/actorHandler/register");

// New: approach/interact flow
const { registerInteractHandler } = require("../handlers/interactHandler");

function registerGameHandlers(io, socket) {
  // Movement
  registerMoveHandler(socket);

  // Click-to-move
  registerClickMoveHandler(socket);

  // Space-hold approach target (player/actor)
  registerInteractHandler(io, socket);

  // World join/resync/baseline
  registerWorldHandler(io, socket);

  // Inventory
  registerInventoryHandler(io, socket);

  // Equipment
  registerEquipmentHandler(io, socket);

  // Research
  registerResearchHandler(io, socket);

  // Authoritative building
  registerBuildHandler(io, socket);

  // Authoritative actor debug transform updates
  registerActorHandler(io, socket);

  // Sleep authoritative via completed shelter
  registerSleepHandler(io, socket);
}

module.exports = {
  registerGameHandlers,
};
