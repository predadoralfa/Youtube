"use strict";

const db = require("../../models");
const {
  resolveInstanceSpawnConfig,
  computeEffectiveRespawnMs,
} = require("./shared");

async function markEnemyDead(enemyId, nowMs = Date.now(), tx = null) {
  const run = async (transaction) => {
    const enemySlot = await db.GaSpawnInstanceEnemy.findByPk(enemyId, {
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

    if (!enemySlot?.spawnInstance?.spawnDef) {
      return null;
    }

    const instanceSpawnConfig = resolveInstanceSpawnConfig(enemySlot.spawnInstance.instance);
    const effectiveRespawnMs = computeEffectiveRespawnMs(
      enemySlot.spawnInstance.spawnDef,
      instanceSpawnConfig
    );

    const deadAt = new Date(nowMs);
    const respawnAt =
      effectiveRespawnMs > 0 ? new Date(nowMs + effectiveRespawnMs) : deadAt;

    await enemySlot.update(
      {
        status: "DEAD",
        dead_at: deadAt,
        respawn_at: respawnAt,
      },
      { transaction }
    );

    return {
      enemyInstanceId: Number(enemySlot.id),
      spawnInstanceId: Number(enemySlot.spawn_instance_id),
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
