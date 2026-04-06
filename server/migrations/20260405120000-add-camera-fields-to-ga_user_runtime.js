'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ga_user_runtime', 'camera_pitch', {
      type: Sequelize.FLOAT,
      allowNull: false,
      defaultValue: Math.PI / 4,
    });

    await queryInterface.addColumn('ga_user_runtime', 'camera_distance', {
      type: Sequelize.FLOAT,
      allowNull: false,
      defaultValue: 26,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('ga_user_runtime', 'camera_distance');
    await queryInterface.removeColumn('ga_user_runtime', 'camera_pitch');
  }
};
