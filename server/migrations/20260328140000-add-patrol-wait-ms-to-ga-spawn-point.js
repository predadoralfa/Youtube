"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ga_spawn_point", "patrol_wait_ms", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 10000,
      after: "patrol_radius",
    });

    await queryInterface.sequelize.query(`
      UPDATE ga_spawn_point
      SET patrol_wait_ms = 10000
      WHERE patrol_wait_ms IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("ga_spawn_point", "patrol_wait_ms");
  },
};
