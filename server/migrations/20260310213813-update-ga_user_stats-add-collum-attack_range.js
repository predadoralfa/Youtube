// migrations/20250310-add-attack-range-to-user-stats.js

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn(
      'ga_user_stats',
      'attack_range',
      {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 1
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('ga_user_stats', 'attack_range');
  }
};