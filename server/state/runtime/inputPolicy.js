// server/state/runtime/inputPolicy.js
const { INPUT_DIR_ACTIVE_MS } = require("./constants");

/**
 * Regra única de "WASD ativo" (para click não cancelar WASD, e WASD cancelar click).
 * Não depende do client mandar dir=0.
 */
function isWASDActive(rt, nowMs = Date.now()) {
  if (!rt) return false;

  const d = rt.inputDir;
  if (!d) return false;

  const hasDir = (Number(d.x) !== 0) || (Number(d.z) !== 0);
  if (!hasDir) return false;

  const at = Number(rt.inputDirAtMs ?? 0);
  if (!Number.isFinite(at) || at <= 0) return false;

  return (nowMs - at) <= INPUT_DIR_ACTIVE_MS;
}

module.exports = {
  isWASDActive,
};