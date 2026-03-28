"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ga_enemy_def_stats", "attack_power", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 5,
      after: "attack_speed",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("ga_enemy_def_stats", "attack_power");
  },
};
