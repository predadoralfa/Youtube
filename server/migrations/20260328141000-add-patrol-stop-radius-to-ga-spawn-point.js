"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ga_spawn_point", "patrol_stop_radius", {
      type: Sequelize.DECIMAL(10, 3),
      allowNull: false,
      defaultValue: 0.5,
      after: "patrol_wait_ms",
    });

    await queryInterface.sequelize.query(`
      UPDATE ga_spawn_point
      SET patrol_stop_radius = 0.5
      WHERE patrol_stop_radius IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("ga_spawn_point", "patrol_stop_radius");
  },
};
