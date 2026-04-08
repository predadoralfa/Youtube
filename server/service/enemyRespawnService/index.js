"use strict";

const {
  normalizeInstanceSpawnConfig,
  resolveInstanceSpawnConfig,
  computeEffectiveRespawnMs,
  computeEffectiveMaxAlive,
  computeEffectiveSpawnQuantity,
} = require("./shared");
const { markEnemyDead } = require("./markEnemyDead");

module.exports = {
  normalizeInstanceSpawnConfig,
  resolveInstanceSpawnConfig,
  computeEffectiveRespawnMs,
  computeEffectiveMaxAlive,
  computeEffectiveSpawnQuantity,
  markEnemyDead,
};
