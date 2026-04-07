"use strict";

function normalizeTableName(t) {
  if (t == null) return "";
  if (typeof t === "string") return t;
  // Some dialects return objects like { tableName, schema }.
  return String(t.tableName ?? t.name ?? "");
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const tablesRaw = await queryInterface.showAllTables({ transaction });
      const tables = (tablesRaw || []).map((t) => normalizeTableName(t).toLowerCase());

      // Idempotent-ish: if already renamed, do nothing.
      if (tables.includes("ga_actor_runtime")) return;

      if (!tables.includes("ga_actor")) {
        throw new Error("rename-ga_actor: expected table ga_actor to exist");
      }

      await queryInterface.renameTable("ga_actor", "ga_actor_runtime", { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const tablesRaw = await queryInterface.showAllTables({ transaction });
      const tables = (tablesRaw || []).map((t) => normalizeTableName(t).toLowerCase());

      if (tables.includes("ga_actor")) return;
      if (!tables.includes("ga_actor_runtime")) return;

      await queryInterface.renameTable("ga_actor_runtime", "ga_actor", { transaction });
    });
  },
};

