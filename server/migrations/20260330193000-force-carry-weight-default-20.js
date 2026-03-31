"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE ga_user_stats
      MODIFY carry_weight FLOAT NOT NULL DEFAULT 20
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE ga_user_stats
      MODIFY carry_weight FLOAT NOT NULL DEFAULT 0
    `);
  },
};
