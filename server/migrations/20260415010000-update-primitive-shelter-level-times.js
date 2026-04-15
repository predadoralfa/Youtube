"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [rows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_research_def
        WHERE code = 'RESEARCH_PRIMITIVE_SHELTER'
        LIMIT 1
        `,
        { transaction }
      );

      const researchDefId = Number(rows?.[0]?.id ?? 0) || null;
      if (!researchDefId) {
        throw new Error("Nao foi possivel localizar RESEARCH_PRIMITIVE_SHELTER para atualizar o tempo.");
      }

      await queryInterface.sequelize.query(
        `
        UPDATE ga_research_level_def
        SET study_time_ms = 420000 * POW(3, level - 1)
        WHERE research_def_id = :researchDefId
        `,
        {
          transaction,
          replacements: { researchDefId },
        }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [rows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_research_def
        WHERE code = 'RESEARCH_PRIMITIVE_SHELTER'
        LIMIT 1
        `,
        { transaction }
      );

      const researchDefId = Number(rows?.[0]?.id ?? 0) || null;
      if (!researchDefId) {
        throw new Error("Nao foi possivel localizar RESEARCH_PRIMITIVE_SHELTER para restaurar o tempo.");
      }

      await queryInterface.sequelize.query(
        `
        UPDATE ga_research_level_def
        SET study_time_ms = 300000 * POW(3, level - 1)
        WHERE research_def_id = :researchDefId
        `,
        {
          transaction,
          replacements: { researchDefId },
        }
      );
    });
  },
};
