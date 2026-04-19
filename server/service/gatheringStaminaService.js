"use strict";

const db = require("../models");
const { getRuntime } = require("../state/runtimeStore");
const {
  readRuntimeStaminaCurrent,
  readRuntimeStaminaMax,
} = require("../state/movement/stamina");

const GATHERING_STAMINA_COST_PER_COLLECT = 1;

async function consumeGatheringStamina(userId, tx, staminaCost = GATHERING_STAMINA_COST_PER_COLLECT) {
  const runtime = getRuntime(userId);
  let stats = null;
  let staminaBefore = 0;
  let staminaMax = 0;

  if (runtime) {
    staminaBefore = readRuntimeStaminaCurrent(runtime);
    staminaMax = readRuntimeStaminaMax(runtime);
  } else {
    stats = await db.GaUserStats.findByPk(userId, {
      transaction: tx ?? undefined,
      lock: tx ? tx.LOCK.UPDATE : undefined,
    });

    if (!stats) {
      return {
        ok: false,
        error: "PLAYER_STATS_NOT_FOUND",
        staminaCost,
        staminaBefore: 0,
        staminaAfter: 0,
        staminaMax: 0,
        message: "Stamina data not found",
      };
    }

    staminaBefore = Number(stats.stamina_current ?? 0);
    staminaMax = Number(stats.stamina_max ?? 0);
  }

  if (staminaBefore < staminaCost) {
    return {
      ok: false,
      error: "INSUFFICIENT_STAMINA",
      staminaCost,
      staminaBefore,
      staminaAfter: staminaBefore,
      staminaMax,
      message: "Not enough stamina to collect",
    };
  }

  if (!stats) {
    stats = await db.GaUserStats.findByPk(userId, {
      transaction: tx ?? undefined,
      lock: tx ? tx.LOCK.UPDATE : undefined,
    });

    if (!stats) {
      return {
        ok: false,
        error: "PLAYER_STATS_NOT_FOUND",
        staminaCost,
        staminaBefore,
        staminaAfter: staminaBefore,
        staminaMax,
        message: "Stamina data not found",
      };
    }
  }

  const staminaAfter = Math.max(0, staminaBefore - staminaCost);
  await stats.update(
    { stamina_current: staminaAfter },
    tx ? { transaction: tx } : undefined
  );

  return {
    ok: true,
    staminaCost,
    staminaBefore,
    staminaAfter,
    staminaMax,
  };
}

module.exports = {
  GATHERING_STAMINA_COST_PER_COLLECT,
  consumeGatheringStamina,
};
