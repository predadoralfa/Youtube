"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ga_user_stats", "hunger_current", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 100,
      after: "stamina_max",
    });

    await queryInterface.addColumn("ga_user_stats", "hunger_max", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 100,
      after: "hunger_current",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("ga_user_stats", "hunger_max");
    await queryInterface.removeColumn("ga_user_stats", "hunger_current");
  },
};
