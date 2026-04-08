"use strict";

const db = require("../../models");
const { clamp, parseMaybeJsonObject, toFiniteNumber } = require("./shared");

function normalizePersistedAutoFoodConfig(row, hungerMax = 100) {
  const rawConfig = row?.config_json ?? row?.configJson ?? {};
  const config = parseMaybeJsonObject(rawConfig) ?? {};
  return {
    itemInstanceId:
      config?.itemInstanceId == null || config?.itemInstanceId === "" ? null : String(config.itemInstanceId),
    hungerThreshold: clamp(
      toFiniteNumber(config?.hungerThreshold, Math.min(60, hungerMax)),
      0,
      Math.max(0, hungerMax)
    ),
    cooldownUntilMs: 0,
    activeConsumption: null,
  };
}

async function loadPersistedAutoFoodConfig(userId, hungerMax = 100) {
  const row = await db.GaUserMacroConfig.findOne({
    where: {
      user_id: Number(userId),
      macro_code: "AUTO_FOOD",
      is_active: true,
    },
  });

  if (!row) {
    return {
      itemInstanceId: null,
      hungerThreshold: Math.min(60, Math.max(0, hungerMax)),
      cooldownUntilMs: 0,
      activeConsumption: null,
    };
  }

  return normalizePersistedAutoFoodConfig(row, hungerMax);
}

async function persistAutoFoodConfig(userId, autoFood) {
  const itemInstanceId =
    autoFood?.itemInstanceId == null || autoFood?.itemInstanceId === "" ? null : String(autoFood.itemInstanceId);
  const hungerThreshold = toFiniteNumber(autoFood?.hungerThreshold, 0);
  const where = {
    user_id: Number(userId),
    macro_code: "AUTO_FOOD",
  };

  const existing = await db.GaUserMacroConfig.findOne({ where });

  if (!itemInstanceId) {
    if (existing) {
      await existing.update({
        is_active: false,
        config_json: null,
        state_json: null,
      });
    } else {
      await db.GaUserMacroConfig.create({
        ...where,
        is_active: false,
        config_json: null,
        state_json: null,
      });
    }
    return;
  }

  if (existing) {
    await existing.update({
      is_active: true,
      config_json: {
        itemInstanceId,
        hungerThreshold,
      },
      state_json: null,
    });
    return;
  }

  await db.GaUserMacroConfig.create({
    ...where,
    is_active: true,
    config_json: {
      itemInstanceId,
      hungerThreshold,
    },
    state_json: null,
  });
}

module.exports = {
  loadPersistedAutoFoodConfig,
  persistAutoFoodConfig,
};
