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

      const appleResearchDefId = await findIdByCode(queryInterface, transaction, "ga_research_def", "RESEARCH_APPLE");
      if (!appleResearchDefId) {
        throw new Error("Nao foi possivel localizar RESEARCH_APPLE.");
      }

      await queryInterface.bulkUpdate(
        "ga_research_def",
        {
          prerequisite_research_def_id: appleResearchDefId,
          prerequisite_level: 2,
        },
        { id: basketResearchDefId },
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

      const twigResearchDefId = await findIdByCode(queryInterface, transaction, "ga_research_def", "RESEARCH_TWIG");
      if (!twigResearchDefId) {
        throw new Error("Nao foi possivel localizar RESEARCH_TWIG.");
      }

      await queryInterface.bulkUpdate(
        "ga_research_def",
        {
          prerequisite_research_def_id: twigResearchDefId,
          prerequisite_level: 3,
        },
        { id: basketResearchDefId },
        { transaction }
      );
    });
  },
};
