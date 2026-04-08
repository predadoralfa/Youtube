"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn("ga_spawn_def_component", "weight").catch(() => {});
    await queryInterface.removeColumn("ga_spawn_def_component", "quantity_min").catch(() => {});
    await queryInterface.removeColumn("ga_spawn_def_component", "quantity_max").catch(() => {});
    await queryInterface.removeColumn("ga_spawn_def_component", "alive_limit").catch(() => {});
    await queryInterface.removeColumn("ga_spawn_def_component", "flags_json").catch(() => {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("ga_spawn_def_component", "weight", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });

    await queryInterface.addColumn("ga_spawn_def_component", "quantity_min", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });

    await queryInterface.addColumn("ga_spawn_def_component", "quantity_max", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });

    await queryInterface.addColumn("ga_spawn_def_component", "alive_limit", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addColumn("ga_spawn_def_component", "flags_json", {
      type: Sequelize.JSON,
      allowNull: true,
    });
  },
};
