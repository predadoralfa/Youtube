"use strict";

const { getFoodMacroState, buildAutoFoodPayload } = require("./shared");
const { loadPersistedAutoFoodConfig } = require("./config");
const { setAutoFoodConfig, startFoodConsumption, consumeOneConfiguredFood } = require("./actions");
const { processAutoFoodTick } = require("./tick");

module.exports = {
  getFoodMacroState,
  buildAutoFoodPayload,
  loadPersistedAutoFoodConfig,
  setAutoFoodConfig,
  startFoodConsumption,
  consumeOneConfiguredFood,
  processAutoFoodTick,
};
