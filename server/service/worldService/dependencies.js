"use strict";

const {
  GaUser,
  GaUserProfile,
  GaUserRuntime,
  GaInstance,
  GaLocal,
  GaLocalGeometry,
  GaLocalVisual,
  GaMaterial,
  GaMeshTemplate,
  GaRenderMaterial,
} = require("../../models");
const { loadPlayerCombatStats } = require("../../state/runtime/combatLoader");
const { ensureInventoryLoaded } = require("../../state/inventory/loader");
const { loadActiveCraftDefs } = require("../../state/inventory/loader/queries");
const { buildInventoryFull } = require("../../state/inventory/fullPayload");
const { ensureEquipmentLoaded } = require("../../state/equipment/loader");
const {
  DEFAULT_LOCAL_VISUAL_VERSION,
  DEFAULT_GROUND_COLOR,
} = require("../../config/worldVisualConstants");
const { getWorldClockBootstrap } = require("../worldClockService");
const { ensureResearchLoaded, buildResearchPayload } = require("../researchService");
const { loadPersistedAutoFoodConfig } = require("../autoFoodService");
const { loadActorsForInstance } = require("../actorLoader");
const {
  addActor,
  clearInstance: clearActorsInstance,
} = require("../../state/actorsRuntimeStore");
const { loadEnemiesForInstance } = require("../enemyLoader");
const {
  addEnemy,
  getEnemiesForInstance,
} = require("../../state/enemies/enemiesRuntimeStore");

module.exports = {
  GaUser,
  GaUserProfile,
  GaUserRuntime,
  GaInstance,
  GaLocal,
  GaLocalGeometry,
  GaLocalVisual,
  GaMaterial,
  GaMeshTemplate,
  GaRenderMaterial,
  loadPlayerCombatStats,
  ensureInventoryLoaded,
  loadActiveCraftDefs,
  buildInventoryFull,
  ensureEquipmentLoaded,
  DEFAULT_LOCAL_VISUAL_VERSION,
  DEFAULT_GROUND_COLOR,
  getWorldClockBootstrap,
  ensureResearchLoaded,
  buildResearchPayload,
  loadPersistedAutoFoodConfig,
  loadActorsForInstance,
  addActor,
  clearActorsInstance,
  loadEnemiesForInstance,
  addEnemy,
  getEnemiesForInstance,
};
