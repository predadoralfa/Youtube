"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ga_spawn_point", "patrol_radius", {
      type: Sequelize.DECIMAL(10, 3),
      allowNull: false,
      defaultValue: 5,
      after: "radius",
    });

    await queryInterface.sequelize.query(`
      UPDATE ga_spawn_point
      SET patrol_radius = 5
      WHERE patrol_radius IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("ga_spawn_point", "patrol_radius");
  },
};
