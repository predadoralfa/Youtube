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
      const basketResearchDefId = await findIdByCode(queryInterface, transaction, "ga_research_def", "RESEARCH_BASKET");
      if (!basketResearchDefId) {
        throw new Error("Nao foi possivel localizar RESEARCH_BASKET.");
      }

      await queryInterface.bulkUpdate(
        "ga_research_level_def",
        {
          requirements_json: JSON.stringify({
            requiresLevel: 3,
            researchRequirements: [{ researchCode: "RESEARCH_TWIG", level: 3 }],
          }),
        },
        { research_def_id: basketResearchDefId, level: 4 },
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const basketResearchDefId = await findIdByCode(queryInterface, transaction, "ga_research_def", "RESEARCH_BASKET");
      if (!basketResearchDefId) {
        throw new Error("Nao foi possivel localizar RESEARCH_BASKET.");
      }

      await queryInterface.bulkUpdate(
        "ga_research_level_def",
        {
          requirements_json: JSON.stringify({
            requiresLevel: 3,
            itemCosts: [{ itemCode: "FIBER", qty: 90 }],
            researchRequirements: [{ researchCode: "RESEARCH_TWIG", level: 3 }],
          }),
        },
        { research_def_id: basketResearchDefId, level: 4 },
        { transaction }
      );
    });
  },
};
