"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [researchRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_research_def
        WHERE code = 'RESEARCH_APPLE'
        LIMIT 1
        `,
        { transaction }
      );

      const researchDefId = Number(researchRows?.[0]?.id ?? 0) || null;
      if (!researchDefId) return;

      const [levelRows] = await queryInterface.sequelize.query(
        `
        SELECT id, grants_json
        FROM ga_research_level_def
        WHERE research_def_id = :researchDefId
          AND level = 5
        LIMIT 1
        `,
        {
          transaction,
          replacements: { researchDefId },
        }
      );

      const levelRow = levelRows?.[0] ?? null;
      if (!levelRow) return;

      let grants = null;
      try {
        grants = typeof levelRow.grants_json === "string" ? JSON.parse(levelRow.grants_json) : levelRow.grants_json;
      } catch {
        grants = null;
      }

      if (!grants || !Array.isArray(grants.unlock)) return;

      const updatedUnlocks = grants.unlock.map((unlock) =>
        String(unlock) === "item.weight_delta:FOOD-APPLE:-1"
          ? "item.weight_delta:FOOD-APPLE:-0.001"
          : unlock
      );

      await queryInterface.bulkUpdate(
        "ga_research_level_def",
        {
          grants_json: JSON.stringify({
            ...grants,
            unlock: updatedUnlocks,
          }),
        },
        { id: levelRow.id },
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [researchRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_research_def
        WHERE code = 'RESEARCH_APPLE'
        LIMIT 1
        `,
        { transaction }
      );

      const researchDefId = Number(researchRows?.[0]?.id ?? 0) || null;
      if (!researchDefId) return;

      const [levelRows] = await queryInterface.sequelize.query(
        `
        SELECT id, grants_json
        FROM ga_research_level_def
        WHERE research_def_id = :researchDefId
          AND level = 5
        LIMIT 1
        `,
        {
          transaction,
          replacements: { researchDefId },
        }
      );

      const levelRow = levelRows?.[0] ?? null;
      if (!levelRow) return;

      let grants = null;
      try {
        grants = typeof levelRow.grants_json === "string" ? JSON.parse(levelRow.grants_json) : levelRow.grants_json;
      } catch {
        grants = null;
      }

      if (!grants || !Array.isArray(grants.unlock)) return;

      const updatedUnlocks = grants.unlock.map((unlock) =>
        String(unlock) === "item.weight_delta:FOOD-APPLE:-0.001"
          ? "item.weight_delta:FOOD-APPLE:-1"
          : unlock
      );

      await queryInterface.bulkUpdate(
        "ga_research_level_def",
        {
          grants_json: JSON.stringify({
            ...grants,
            unlock: updatedUnlocks,
          }),
        },
        { id: levelRow.id },
        { transaction }
      );
    });
  },
};
