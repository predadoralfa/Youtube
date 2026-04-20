"use strict";

const db = require("../../models");

let cachedSupport = null;

async function getUserStatsSupport() {
  if (cachedSupport) return cachedSupport;

  const table = await db.sequelize.getQueryInterface().describeTable("ga_user_stats").catch(() => null);
  const supportsThirst =
    Boolean(table) && Object.prototype.hasOwnProperty.call(table, "thirst_current") && Object.prototype.hasOwnProperty.call(table, "thirst_max");
  const supportsStatus =
    Boolean(table) &&
    Object.prototype.hasOwnProperty.call(table, "immunity_current") &&
    Object.prototype.hasOwnProperty.call(table, "immunity_max") &&
    Object.prototype.hasOwnProperty.call(table, "disease_level") &&
    Object.prototype.hasOwnProperty.call(table, "disease_severity") &&
    Object.prototype.hasOwnProperty.call(table, "sleep_current") &&
    Object.prototype.hasOwnProperty.call(table, "sleep_max");

  cachedSupport = {
    supportsThirst,
    supportsStatus,
  };

  return cachedSupport;
}

async function ensureUserStatsModelSchema() {
  const support = await getUserStatsSupport();

  if (!support.supportsThirst) {
    if (typeof db.GaUserStats?.removeAttribute === "function") {
      db.GaUserStats.removeAttribute("thirst_current");
      db.GaUserStats.removeAttribute("thirst_max");
    }
  }

  if (!support.supportsStatus) {
    if (typeof db.GaUserStats?.removeAttribute === "function") {
      db.GaUserStats.removeAttribute("immunity_current");
      db.GaUserStats.removeAttribute("immunity_max");
      db.GaUserStats.removeAttribute("disease_level");
      db.GaUserStats.removeAttribute("disease_severity");
      db.GaUserStats.removeAttribute("sleep_current");
      db.GaUserStats.removeAttribute("sleep_max");
    }
  }

  return support;
}

module.exports = {
  getUserStatsSupport,
  ensureUserStatsModelSchema,
};
