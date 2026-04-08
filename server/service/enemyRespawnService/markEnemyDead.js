"use strict";

const db = require("../../models");
const {
  resolveInstanceSpawnConfig,
  computeEffectiveRespawnMs,
} = require("./shared");

async function markEnemyDead(enemyId, nowMs = Date.now(), tx = null) {
  const run = async (transaction) => {
    const enemyRuntime = await db.GaEnemyRuntime.findByPk(enemyId, {
      include: [
        {
          association: "spawnInstance",
          required: true,
          include: [
            {
              association: "spawnDef",
              required: true,
            },
            {
              association: "instance",
              required: false,
              include: [
                {
                  association: "spawnConfig",
                  required: false,
                },
              ],
            },
          ],
        },
      ],
      transaction,
    });

    if (!enemyRuntime?.spawnInstance?.spawnDef) {
      return null;
    }

    const instanceSpawnConfig = resolveInstanceSpawnConfig(enemyRuntime.spawnInstance.instance);
    const effectiveRespawnMs = computeEffectiveRespawnMs(
      enemyRuntime.spawnInstance.spawnDef,
      instanceSpawnConfig
    );

    const deadAt = new Date(nowMs);
    const respawnAt =
      effectiveRespawnMs > 0 ? new Date(nowMs + effectiveRespawnMs) : deadAt;

    await enemyRuntime.update(
      {
        status: "DEAD",
        dead_at: deadAt,
        respawn_at: respawnAt,
      },
      { transaction }
    );

    return {
      enemyInstanceId: Number(enemyRuntime.id),
      spawnInstanceId: Number(enemyRuntime.spawn_instance_id),
      deadAt,
      respawnAt,
      effectiveRespawnMs,
    };
  };

  if (tx) {
    return run(tx);
  }

  return run(null);
}

module.exports = {
  markEnemyDead,
};
