"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        ALTER TABLE ga_skill_level_def
        MODIFY required_xp DECIMAL(65,0) UNSIGNED NOT NULL DEFAULT 0;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
        ALTER TABLE ga_user_skill
        MODIFY current_xp DECIMAL(65,0) UNSIGNED NOT NULL DEFAULT 0;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
        ALTER TABLE ga_user_skill
        MODIFY total_xp DECIMAL(65,0) UNSIGNED NOT NULL DEFAULT 0;
        `,
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        ALTER TABLE ga_skill_level_def
        MODIFY required_xp BIGINT UNSIGNED NOT NULL DEFAULT 0;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
        ALTER TABLE ga_user_skill
        MODIFY current_xp BIGINT UNSIGNED NOT NULL DEFAULT 0;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
        ALTER TABLE ga_user_skill
        MODIFY total_xp BIGINT UNSIGNED NOT NULL DEFAULT 0;
        `,
        { transaction }
      );
    });
  },
};
