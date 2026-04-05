"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("ga_user_stats", "hunger_current", {
      type: Sequelize.DOUBLE.UNSIGNED,
      allowNull: false,
      defaultValue: 100,
    });

    await queryInterface.changeColumn("ga_user_stats", "hunger_max", {
      type: Sequelize.DOUBLE.UNSIGNED,
      allowNull: false,
      defaultValue: 100,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("ga_user_stats", "hunger_current", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 100,
    });

    await queryInterface.changeColumn("ga_user_stats", "hunger_max", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 100,
    });
  },
};
