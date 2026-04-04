"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE ga_user_stats
      MODIFY hunger_current INT UNSIGNED NOT NULL DEFAULT 100
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE ga_user_stats
      MODIFY hunger_max INT UNSIGNED NOT NULL DEFAULT 100
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE ga_user_stats
      MODIFY hunger_current INT UNSIGNED NOT NULL DEFAULT 0
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE ga_user_stats
      MODIFY hunger_max INT UNSIGNED NOT NULL DEFAULT 0
    `);
  },
};
