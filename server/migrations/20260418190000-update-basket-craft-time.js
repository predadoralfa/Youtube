"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkUpdate(
        "ga_craft_def",
        {
          craft_time_ms: 600000,
        },
        { code: "CRAFT_BASKET" },
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkUpdate(
        "ga_craft_def",
        {
          craft_time_ms: 30000,
        },
        { code: "CRAFT_BASKET" },
        { transaction }
      );
    });
  },
};
