"use strict";

const {
  readRuntimeStaminaCurrent,
  readRuntimeStaminaMax,
  readRuntimeHpCurrent,
  readRuntimeHpMax,
  readRuntimeHungerCurrent,
  readRuntimeHungerMax,
} = require("./runtimeVitals/readers");
const {
  syncRuntimeHp,
  syncRuntimeStamina,
  syncRuntimeHunger,
} = require("./runtimeVitals/syncers");

module.exports = {
  readRuntimeStaminaCurrent,
  readRuntimeStaminaMax,
  readRuntimeHpCurrent,
  readRuntimeHpMax,
  readRuntimeHungerCurrent,
  readRuntimeHungerMax,
  syncRuntimeHp,
  syncRuntimeStamina,
  syncRuntimeHunger,
};
