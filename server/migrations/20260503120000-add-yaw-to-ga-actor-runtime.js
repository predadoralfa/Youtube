"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ga_actor_runtime", "yaw", {
      type: Sequelize.DECIMAL(10, 3),
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("ga_actor_runtime", "yaw");
  },
};
