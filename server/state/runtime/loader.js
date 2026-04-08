"use strict";

const { ensureRuntimeLoaded } = require("./loader/ensureRuntimeLoaded");
const {
  refreshRuntimeStats,
  refreshRuntimeCombatStats,
} = require("./loader/refreshers");
const {
  sanitizeSpeed,
  toNum,
  applyCombatStatsToRuntime,
} = require("./loader/shared");
const {
  loadSpeedFromStats,
  loadBoundsForInstance,
} = require("./loader/queries");

module.exports = {
  ensureRuntimeLoaded,
  refreshRuntimeStats,
  refreshRuntimeCombatStats,
  _internal: {
    sanitizeSpeed,
    toNum,
    loadSpeedFromStats,
    loadBoundsForInstance,
    applyCombatStatsToRuntime,
  },
};
