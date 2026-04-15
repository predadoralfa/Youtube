"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkUpdate(
        "ga_item_def",
        {
          unit_weight: 0.16,
        },
        { code: "FIBER" },
        { transaction }
      );

      await queryInterface.bulkUpdate(
        "ga_item_def",
        {
          stack_max: 100,
        },
        { code: "SMALL_STONE" },
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkUpdate(
        "ga_item_def",
        {
          unit_weight: 0.2,
        },
        { code: "FIBER" },
        { transaction }
      );

      await queryInterface.bulkUpdate(
        "ga_item_def",
        {
          stack_max: 50,
        },
        { code: "SMALL_STONE" },
        { transaction }
      );
    });
  },
};
