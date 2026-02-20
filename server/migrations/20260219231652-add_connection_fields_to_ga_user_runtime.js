'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ga_user_runtime', 'connection_state', {
      type: Sequelize.STRING(32),
      allowNull: false,
      defaultValue: 'OFFLINE',
    });

    await queryInterface.addColumn('ga_user_runtime', 'disconnected_at', {
      type: Sequelize.BIGINT,
      allowNull: true,
    });

    await queryInterface.addColumn('ga_user_runtime', 'offline_allowed_at', {
      type: Sequelize.BIGINT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('ga_user_runtime', 'offline_allowed_at');
    await queryInterface.removeColumn('ga_user_runtime', 'disconnected_at');
    await queryInterface.removeColumn('ga_user_runtime', 'connection_state');
  }
};