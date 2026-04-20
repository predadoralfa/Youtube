"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ga_user_stats", "immunity_current", {
      type: Sequelize.DOUBLE.UNSIGNED,
      allowNull: false,
      defaultValue: 100,
      after: "thirst_max",
    });

    await queryInterface.addColumn("ga_user_stats", "immunity_max", {
      type: Sequelize.DOUBLE.UNSIGNED,
      allowNull: false,
      defaultValue: 100,
      after: "immunity_current",
    });

    await queryInterface.addColumn("ga_user_stats", "disease_level", {
      type: Sequelize.DOUBLE.UNSIGNED,
      allowNull: false,
      defaultValue: 100,
      after: "immunity_max",
    });

    await queryInterface.addColumn("ga_user_stats", "disease_severity", {
      type: Sequelize.DOUBLE.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      after: "disease_level",
    });

    await queryInterface.addColumn("ga_user_stats", "sleep_current", {
      type: Sequelize.DOUBLE.UNSIGNED,
      allowNull: false,
      defaultValue: 100,
      after: "disease_severity",
    });

    await queryInterface.addColumn("ga_user_stats", "sleep_max", {
      type: Sequelize.DOUBLE.UNSIGNED,
      allowNull: false,
      defaultValue: 100,
      after: "sleep_current",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("ga_user_stats", "sleep_max");
    await queryInterface.removeColumn("ga_user_stats", "sleep_current");
    await queryInterface.removeColumn("ga_user_stats", "disease_severity");
    await queryInterface.removeColumn("ga_user_stats", "disease_level");
    await queryInterface.removeColumn("ga_user_stats", "immunity_max");
    await queryInterface.removeColumn("ga_user_stats", "immunity_current");
  },
};
