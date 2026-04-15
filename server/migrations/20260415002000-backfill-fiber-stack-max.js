"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkUpdate(
        "ga_item_def",
        {
          stack_max: 100,
        },
        { code: "FIBER" },
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkUpdate(
        "ga_item_def",
        {
          stack_max: 10,
        },
        { code: "FIBER" },
        { transaction }
      );
    });
  },
};
