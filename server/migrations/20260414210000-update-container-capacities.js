"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkUpdate(
      "ga_container_def",
      { max_weight: 2.5 },
      { code: { [Sequelize.Op.in]: ["HAND_L", "HAND_R"] } }
    );

    await queryInterface.bulkUpdate(
      "ga_container_def",
      { max_weight: 10 },
      { code: "BASKET" }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkUpdate(
      "ga_container_def",
      { max_weight: null },
      { code: { [Sequelize.Op.in]: ["HAND_L", "HAND_R", "BASKET"] } }
    );
  },
};
