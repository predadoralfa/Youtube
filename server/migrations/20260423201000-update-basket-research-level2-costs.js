"use strict";

async function findIdByCode(queryInterface, transaction, tableName, code) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ${tableName}
    WHERE code = :code
    LIMIT 1
    `,
    {
      transaction,
      replacements: { code },
    }
  );

  return Number(rows?.[0]?.id ?? 0) || null;
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const researchDefId = await findIdByCode(
        queryInterface,
        transaction,
        "ga_research_def",
        "RESEARCH_BASKET"
      );
      if (!researchDefId) {
        throw new Error("Nao foi possivel localizar RESEARCH_BASKET.");
      }

      await queryInterface.bulkUpdate(
        "ga_research_level_def",
        {
          requirements_json: JSON.stringify({
            requiresLevel: 1,
            itemCosts: [
              { itemCode: "FIBER", qty: 10 },
              { itemCode: "GRAVETO", qty: 10 },
            ],
          }),
        },
        { research_def_id: researchDefId, level: 2 },
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const researchDefId = await findIdByCode(
        queryInterface,
        transaction,
        "ga_research_def",
        "RESEARCH_BASKET"
      );
      if (!researchDefId) {
        throw new Error("Nao foi possivel localizar RESEARCH_BASKET.");
      }

      await queryInterface.bulkUpdate(
        "ga_research_level_def",
        {
          requirements_json: JSON.stringify({
            requiresLevel: 1,
            itemCosts: [],
          }),
        },
        { research_def_id: researchDefId, level: 2 },
        { transaction }
      );
    });
  },
};
