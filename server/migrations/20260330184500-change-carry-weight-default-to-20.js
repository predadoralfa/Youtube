"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("ga_user_stats", "carry_weight", {
      type: Sequelize.FLOAT,
      allowNull: false,
      defaultValue: 20,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("ga_user_stats", "carry_weight", {
      type: Sequelize.FLOAT,
      allowNull: false,
      defaultValue: 0,
    });
  },
};
