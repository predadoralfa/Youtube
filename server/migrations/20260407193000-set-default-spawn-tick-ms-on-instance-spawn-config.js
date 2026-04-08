"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("ga_instance_spawn_config", "spawn_tick_ms", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 60000,
    });

    await queryInterface.sequelize.query(`
      UPDATE ga_instance_spawn_config
      SET spawn_tick_ms = 60000
      WHERE spawn_tick_ms IS NULL
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("ga_instance_spawn_config", "spawn_tick_ms", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
    });
  },
};
