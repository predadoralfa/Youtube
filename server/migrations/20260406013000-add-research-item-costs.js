"use strict";

function levelCostQty(level) {
  return 10 * Math.pow(3, level - 1);
}

function buildRequirements(level, itemCode) {
  return {
    requiresLevel: level > 1 ? level - 1 : null,
    itemCosts: [
      {
        itemCode,
        qty: levelCostQty(level),
      },
    ],
  };
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [researchRows] = await queryInterface.sequelize.query(
        `
        SELECT id, code
        FROM ga_research_def
        WHERE code IN ('RESEARCH_APPLE', 'RESEARCH_STONE', 'RESEARCH_PRIMITIVE_SHELTER')
        `,
        { transaction }
      );

      const researchIdByCode = new Map(researchRows.map((row) => [String(row.code), Number(row.id)]));

      const updates = [
        {
          code: "RESEARCH_APPLE",
          itemCode: "FOOD-APPLE",
          levels: [1, 2, 3, 4, 5],
        },
        {
          code: "RESEARCH_STONE",
          itemCode: "SMALL_STONE",
          levels: [1, 2, 3, 4, 5],
        },
        {
          code: "RESEARCH_PRIMITIVE_SHELTER",
          itemCode: "SMALL_STONE",
          levels: [1, 2, 3, 4, 5],
        },
      ];

      for (const update of updates) {
        const researchDefId = researchIdByCode.get(update.code);
        if (!researchDefId) continue;

        for (const level of update.levels) {
          const requirements = buildRequirements(level, update.itemCode);

          await queryInterface.bulkUpdate(
            "ga_research_level_def",
            {
              requirements_json: JSON.stringify(requirements),
            },
            {
              research_def_id: researchDefId,
              level,
            },
            { transaction }
          );
        }
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [researchRows] = await queryInterface.sequelize.query(
        `
        SELECT id, code
        FROM ga_research_def
        WHERE code IN ('RESEARCH_APPLE', 'RESEARCH_STONE', 'RESEARCH_PRIMITIVE_SHELTER')
        `,
        { transaction }
      );

      const researchIdByCode = new Map(researchRows.map((row) => [String(row.code), Number(row.id)]));

      const targets = [
        { code: "RESEARCH_APPLE", levels: [1, 2, 3, 4, 5] },
        { code: "RESEARCH_STONE", levels: [1, 2, 3, 4, 5] },
        { code: "RESEARCH_PRIMITIVE_SHELTER", levels: [1, 2, 3, 4, 5] },
      ];

      for (const target of targets) {
        const researchDefId = researchIdByCode.get(target.code);
        if (!researchDefId) continue;

        for (const level of target.levels) {
          await queryInterface.bulkUpdate(
            "ga_research_level_def",
            {
              requirements_json: level > 1 ? JSON.stringify({ requiresLevel: level - 1 }) : null,
            },
            {
              research_def_id: researchDefId,
              level,
            },
            { transaction }
          );
        }
      }
    });
  },
};
