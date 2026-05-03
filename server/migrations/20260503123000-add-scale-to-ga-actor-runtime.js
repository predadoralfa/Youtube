"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ga_actor_runtime", "scale_x", {
      type: Sequelize.DECIMAL(10, 3),
      allowNull: false,
      defaultValue: 1,
    });

    await queryInterface.addColumn("ga_actor_runtime", "scale_y", {
      type: Sequelize.DECIMAL(10, 3),
      allowNull: false,
      defaultValue: 1,
    });

    await queryInterface.addColumn("ga_actor_runtime", "scale_z", {
      type: Sequelize.DECIMAL(10, 3),
      allowNull: false,
      defaultValue: 1,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("ga_actor_runtime", "scale_z");
    await queryInterface.removeColumn("ga_actor_runtime", "scale_y");
    await queryInterface.removeColumn("ga_actor_runtime", "scale_x");
  },
};
