// server/state/runtime/inputPolicy.js
const { isWASDIntentActive } = require("../movement/input");

/**
 * Regra única de "WASD ativo" (para click não cancelar WASD, e WASD cancelar click).
 * Não depende do client mandar dir=0.
 */
function isWASDActive(rt) {
  if (!rt) return false;
  if (rt.buildLock?.active) return false;
  if (rt.sleepLock?.active) return false;
  return isWASDIntentActive(rt);
}

module.exports = {
  isWASDActive,
};
