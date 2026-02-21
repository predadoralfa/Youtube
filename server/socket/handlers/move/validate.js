// server/socket/handlers/move/validate.js

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * Valida payload e normaliza os campos que o core espera.
 * Retorna { dir, yawDesired } ou null.
 */
function parseMoveIntentPayload(payload) {
  const dir = payload?.dir;
  const yawDesired = payload?.yawDesired;

  if (!dir || !isFiniteNumber(dir.x) || !isFiniteNumber(dir.z)) return null;

  return {
    dir: { x: Number(dir.x), z: Number(dir.z) },
    yawDesired: isFiniteNumber(yawDesired) ? Number(yawDesired) : null,
  };
}

module.exports = {
  isFiniteNumber,
  parseMoveIntentPayload,
};