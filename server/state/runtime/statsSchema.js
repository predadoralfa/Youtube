"use strict";

const db = require("../../models");

let cachedSupport = null;

async function getUserStatsSupport() {
  if (cachedSupport) return cachedSupport;

  const table = await db.sequelize.getQueryInterface().describeTable("ga_user_stats").catch(() => null);
  const supportsThirst =
    Boolean(table) && Object.prototype.hasOwnProperty.call(table, "thirst_current") && Object.prototype.hasOwnProperty.call(table, "thirst_max");

  cachedSupport = {
    supportsThirst,
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

  return support;
}

module.exports = {
  getUserStatsSupport,
  ensureUserStatsModelSchema,
};
