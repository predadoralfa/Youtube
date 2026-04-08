"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        UPDATE ga_research_level_def
        SET requirements_json = NULL
        WHERE level = 1
        `,
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        UPDATE ga_research_level_def
        SET requirements_json = NULL
        WHERE level = 1
        `,
        { transaction }
      );
    });
  },
};
