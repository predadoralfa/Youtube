"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ga_user_stats", "hp_current", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 100,
      after: "user_id",
    });

    await queryInterface.addColumn("ga_user_stats", "hp_max", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 100,
      after: "hp_current",
    });

    await queryInterface.addColumn("ga_user_stats", "stamina_current", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 100,
      after: "hp_max",
    });

    await queryInterface.addColumn("ga_user_stats", "stamina_max", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 100,
      after: "stamina_current",
    });

    await queryInterface.addColumn("ga_user_stats", "attack_power", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 10,
      after: "stamina_max",
    });

    await queryInterface.addColumn("ga_user_stats", "defense", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      after: "attack_power",
    });

    await queryInterface.addColumn("ga_user_stats", "attack_speed", {
      type: Sequelize.FLOAT,
      allowNull: false,
      defaultValue: 1,
      after: "defense",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("ga_user_stats", "attack_speed");
    await queryInterface.removeColumn("ga_user_stats", "defense");
    await queryInterface.removeColumn("ga_user_stats", "attack_power");
    await queryInterface.removeColumn("ga_user_stats", "stamina_max");
    await queryInterface.removeColumn("ga_user_stats", "stamina_current");
    await queryInterface.removeColumn("ga_user_stats", "hp_max");
    await queryInterface.removeColumn("ga_user_stats", "hp_current");
  },
};