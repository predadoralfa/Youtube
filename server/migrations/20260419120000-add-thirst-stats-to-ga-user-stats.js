"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ga_user_stats", "thirst_current", {
      type: Sequelize.DOUBLE.UNSIGNED,
      allowNull: false,
      defaultValue: 100,
      after: "hunger_max",
    });

    await queryInterface.addColumn("ga_user_stats", "thirst_max", {
      type: Sequelize.DOUBLE.UNSIGNED,
      allowNull: false,
      defaultValue: 100,
      after: "thirst_current",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("ga_user_stats", "thirst_max");
    await queryInterface.removeColumn("ga_user_stats", "thirst_current");
  },
};
