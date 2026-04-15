"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkUpdate(
        "ga_item_def",
        {
          unit_weight: 0.2,
        },
        { code: "FIBER" },
        { transaction }
      );

      const [researchRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_research_def
        WHERE code = 'RESEARCH_FIBER'
        LIMIT 1
        `,
        { transaction }
      );

      const researchDefId = Number(researchRows?.[0]?.id ?? 0) || null;
      if (!researchDefId) {
        throw new Error("Nao foi possivel localizar RESEARCH_FIBER para atualizar o bonus.");
      }

      await queryInterface.bulkUpdate(
        "ga_research_level_def",
        {
          description: "Reduce the carried weight of each fiber by 50 grams.",
          grants_json: JSON.stringify({ unlock: ["item.weight_delta:FIBER:-0.05"] }),
        },
        {
          research_def_id: researchDefId,
          level: 2,
        },
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkUpdate(
        "ga_item_def",
        {
          unit_weight: 0.16,
        },
        { code: "FIBER" },
        { transaction }
      );

      const [researchRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_research_def
        WHERE code = 'RESEARCH_FIBER'
        LIMIT 1
        `,
        { transaction }
      );

      const researchDefId = Number(researchRows?.[0]?.id ?? 0) || null;
      if (!researchDefId) return;

      await queryInterface.bulkUpdate(
        "ga_research_level_def",
        {
          description: "Learn how to gather and sort workable fiber bundles.",
          grants_json: JSON.stringify({ unlock: [] }),
        },
        {
          research_def_id: researchDefId,
          level: 2,
        },
        { transaction }
      );
    });
  },
};
