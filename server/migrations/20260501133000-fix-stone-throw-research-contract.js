"use strict";

async function findIdByCode(queryInterface, transaction, tableName, code) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ${tableName}
    WHERE code = :code
    LIMIT 1
    `,
    { transaction, replacements: { code } }
  );

  return Number(rows?.[0]?.id ?? 0) || null;
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const stoneResearchDefId = await findIdByCode(queryInterface, transaction, "ga_research_def", "RESEARCH_STONE");
      const stoneThrowItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "STONE_THROW");
      const stoneThrowResearchDefId = await findIdByCode(queryInterface, transaction, "ga_research_def", "RESEARCH_STONE_THROW");

      if (!stoneResearchDefId) throw new Error("Nao foi possivel localizar RESEARCH_STONE.");
      if (!stoneThrowItemDefId) throw new Error("Nao foi possivel localizar STONE_THROW.");
      if (!stoneThrowResearchDefId) throw new Error("Nao foi possivel localizar RESEARCH_STONE_THROW.");

      await queryInterface.bulkUpdate(
        "ga_research_def",
        {
          item_def_id: stoneThrowItemDefId,
          prerequisite_research_def_id: stoneResearchDefId,
          prerequisite_level: 4,
          max_level: 1,
          is_active: true,
        },
        { id: stoneThrowResearchDefId, code: "RESEARCH_STONE_THROW" },
        { transaction }
      );

      const [levelRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_research_level_def
        WHERE research_def_id = :researchDefId
          AND level = 1
        LIMIT 1
        `,
        {
          transaction,
          replacements: { researchDefId: stoneThrowResearchDefId },
        }
      );

      const levelPayload = {
        research_def_id: stoneThrowResearchDefId,
        level: 1,
        study_time_ms: 3600000,
        title: "Stone Throw Crafting",
        description: "Unlock crafting the Stone Throw weapon.",
        grants_json: JSON.stringify({ unlock: ["recipe.craft:CRAFT_STONE_THROW"] }),
        requirements_json: null,
      };

      if (levelRows?.[0]?.id) {
        await queryInterface.bulkUpdate(
          "ga_research_level_def",
          levelPayload,
          { id: levelRows[0].id },
          { transaction }
        );
      } else {
        await queryInterface.bulkInsert("ga_research_level_def", [levelPayload], { transaction });
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const stoneThrowResearchDefId = await findIdByCode(queryInterface, transaction, "ga_research_def", "RESEARCH_STONE_THROW");
      if (!stoneThrowResearchDefId) return;

      await queryInterface.bulkUpdate(
        "ga_research_level_def",
        {
          study_time_ms: 300000,
          title: "Stone Throw Crafting",
          description: "Unlock crafting the Stone Throw weapon.",
          grants_json: JSON.stringify({ unlock: ["recipe.craft:CRAFT_STONE_THROW"] }),
          requirements_json: null,
        },
        { research_def_id: stoneThrowResearchDefId, level: 1 },
        { transaction }
      );
    });
  },
};
