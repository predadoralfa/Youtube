// server/state/spawnManager.js

const { startSpawnLoop, stopSpawnLoop } = require("./spawn/spawnLoop");

/**
 * API pública do spawn manager.
 * 
 * Chamado de server.js no bootstrap:
 *   startSpawnManager()
 * 
 * E no shutdown:
 *   stopSpawnManager()
 */

function startSpawnManager() {
  startSpawnLoop();
}

function stopSpawnManager() {
  stopSpawnLoop();
}

module.exports = {
  startSpawnManager,
  stopSpawnManager,
};