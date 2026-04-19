"use strict";

const db = require("../../models");

let cachedSupport = null;

async function getItemDefSupport() {
  if (cachedSupport) return cachedSupport;

  const table = await db.sequelize.getQueryInterface().describeTable("ga_item_def").catch(() => null);
  const supportsAssetKey =
    Boolean(table) && Object.prototype.hasOwnProperty.call(table, "asset_key");

  cachedSupport = {
    supportsAssetKey,
  };

  return cachedSupport;
}

async function ensureItemDefModelSchema() {
  const support = await getItemDefSupport();

  if (!support.supportsAssetKey) {
    if (typeof db.GaItemDef?.removeAttribute === "function") {
      db.GaItemDef.removeAttribute("asset_key");
    }
  }

  return support;
}

module.exports = {
  getItemDefSupport,
  ensureItemDefModelSchema,
};
