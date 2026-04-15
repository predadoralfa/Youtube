"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkUpdate(
        "ga_user_stats",
        {
          collect_cooldown_ms: 4000,
          updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        {},
        { transaction }
      );
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkUpdate(
        "ga_user_stats",
        {
          collect_cooldown_ms: 1000,
          updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        {},
        { transaction }
      );
    });
  },
};
