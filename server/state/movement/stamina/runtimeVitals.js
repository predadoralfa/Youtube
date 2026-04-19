"use strict";

const {
  readRuntimeStaminaCurrent,
  readRuntimeStaminaMax,
  readRuntimeHpCurrent,
  readRuntimeHpMax,
  readRuntimeHungerCurrent,
  readRuntimeHungerMax,
  readRuntimeThirstCurrent,
  readRuntimeThirstMax,
} = require("./runtimeVitals/readers");
const {
  syncRuntimeHp,
  syncRuntimeStamina,
  syncRuntimeHunger,
  syncRuntimeThirst,
} = require("./runtimeVitals/syncers");

module.exports = {
  readRuntimeStaminaCurrent,
  readRuntimeStaminaMax,
  readRuntimeHpCurrent,
  readRuntimeHpMax,
  readRuntimeHungerCurrent,
  readRuntimeHungerMax,
  readRuntimeThirstCurrent,
  readRuntimeThirstMax,
  syncRuntimeHp,
  syncRuntimeStamina,
  syncRuntimeHunger,
  syncRuntimeThirst,
};
