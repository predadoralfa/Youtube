"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("ga_user_stats", "disease_level", {
      type: Sequelize.DOUBLE.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("ga_user_stats", "disease_level", {
      type: Sequelize.DOUBLE.UNSIGNED,
      allowNull: false,
      defaultValue: 100,
    });
  },
};
