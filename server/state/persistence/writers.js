// server/state/persistence/writers.js
const db = require("../../models");

const { getRuntime } = require("../runtimeStore");

/**
 * Flush do runtime (pos/yaw/instance + connection fields)
 * - UPDATE por PK user_id
 */
async function flushUserRuntime(userId, now) {
  const rt = getRuntime(userId);
  if (!rt) return false;

  // Só escreve se ainda está dirty
  if (!rt.dirtyRuntime) return false;

  try {
    const payload = {
      instance_id: rt.instanceId,
      pos_x: rt.pos?.x ?? 0,
      pos_y: rt.pos?.y ?? 0,
      pos_z: rt.pos?.z ?? 0,
      yaw: rt.yaw ?? 0,

      connection_state: rt.connectionState ?? "OFFLINE",
      disconnected_at: rt.disconnectedAtMs ?? null,
      offline_allowed_at: rt.offlineAllowedAtMs ?? null,
    };

    await db.GaUserRuntime.update(payload, {
      where: { user_id: rt.userId },
    });

    rt.dirtyRuntime = false;

    // log só em eventos relevantes
    if (rt.connectionState !== "CONNECTED") {
      console.log(
        `[PERSIST] flushed runtime user=${rt.userId} state=${rt.connectionState}`
      );
    }

    return true;
  } catch (err) {
    console.error(`[PERSIST] flushUserRuntime failed user=${rt?.userId}`, err);
    return false;
  }
}

/**
 * Flush dos stats.
 * Hoje: só move_speed existe.
 * Amanhã: você pode expandir para payload parcial (dirty fields).
 */
async function flushUserStats(userId, now) {
  const rt = getRuntime(userId);
  if (!rt) return false;
  if (!rt.dirtyStats) return false;

  try {
    // Por padrão: apenas limpa dirtyStats para não ficar batendo.
    rt.dirtyStats = false;
    return true;
  } catch (err) {
    console.error(`[PERSIST] flushUserStats failed user=${rt?.userId}`, err);
    return false;
  }
}

module.exports = {
  flushUserRuntime,
  flushUserStats,
};