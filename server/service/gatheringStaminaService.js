"use strict";

const db = require("../models");
const { getRuntime, markStatsDirty } = require("../state/runtimeStore");
const {
  readRuntimeStaminaCurrent,
  readRuntimeStaminaMax,
  syncRuntimeStamina,
} = require("../state/movement/stamina");

const GATHERING_STAMINA_COST_PER_COLLECT = 1;

async function consumeGatheringStamina(userId, tx, staminaCost = GATHERING_STAMINA_COST_PER_COLLECT) {
  const runtime = getRuntime(userId);
  const numericCost = Math.max(0, Math.floor(Number(staminaCost) || 0));
  if (numericCost <= 0) {
    return {
      ok: true,
      staminaCost: 0,
      staminaBefore: runtime ? readRuntimeStaminaCurrent(runtime) : 0,
      staminaAfter: runtime ? readRuntimeStaminaCurrent(runtime) : 0,
      staminaMax: runtime ? readRuntimeStaminaMax(runtime) : 0,
    };
  }

  if (runtime) {
    const staminaBefore = readRuntimeStaminaCurrent(runtime);
    const staminaMax = readRuntimeStaminaMax(runtime);

    if (staminaBefore < numericCost) {
      return {
        ok: false,
        error: "INSUFFICIENT_STAMINA",
        staminaCost: numericCost,
        staminaBefore,
        staminaAfter: staminaBefore,
        staminaMax,
        message: "Not enough stamina to collect",
      };
    }

    const staminaAfter = Math.max(0, staminaBefore - numericCost);
    syncRuntimeStamina(runtime, staminaAfter, staminaMax);
    markStatsDirty(userId);

    return {
      ok: true,
      staminaCost: numericCost,
      staminaBefore,
      staminaAfter,
      staminaMax,
    };
  }

  const [affectedRows] = await db.GaUserStats.update(
    {
      stamina_current: db.sequelize.literal(`stamina_current - ${numericCost}`),
    },
    {
      where: {
        user_id: userId,
        stamina_current: {
          [db.Sequelize.Op.gte]: numericCost,
        },
      },
      transaction: tx ?? undefined,
    }
  );

  if (!affectedRows) {
    const stats = await db.GaUserStats.findByPk(userId, {
      transaction: tx ?? undefined,
    });

    if (!stats) {
      return {
        ok: false,
        error: "PLAYER_STATS_NOT_FOUND",
        staminaCost: numericCost,
        staminaBefore: 0,
        staminaAfter: 0,
        staminaMax: 0,
        message: "Stamina data not found",
      };
    }

    const staminaBefore = Number(stats.stamina_current ?? 0);
    const staminaMax = Number(stats.stamina_max ?? 0);
    return {
      ok: false,
      error: "INSUFFICIENT_STAMINA",
      staminaCost: numericCost,
      staminaBefore,
      staminaAfter: staminaBefore,
      staminaMax,
      message: "Not enough stamina to collect",
    };
  }

  const updatedStats = await db.GaUserStats.findByPk(userId, {
    transaction: tx ?? undefined,
  });

  if (!updatedStats) {
    return {
      ok: false,
      error: "PLAYER_STATS_NOT_FOUND",
      staminaCost: numericCost,
      staminaBefore: 0,
      staminaAfter: 0,
      staminaMax: 0,
      message: "Stamina data not found",
    };
  }

  const staminaAfter = Number(updatedStats.stamina_current ?? 0);
  const staminaMax = Number(updatedStats.stamina_max ?? 0);
  const staminaBefore = staminaAfter + numericCost;

  return {
    ok: true,
    staminaCost: numericCost,
    staminaBefore,
    staminaAfter,
    staminaMax,
  };
}

module.exports = {
  GATHERING_STAMINA_COST_PER_COLLECT,
  consumeGatheringStamina,
};
