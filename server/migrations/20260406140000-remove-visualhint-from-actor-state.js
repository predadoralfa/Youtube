"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE ga_actor
      SET state_json = JSON_REMOVE(state_json, '$.visualHint')
      WHERE state_json IS NOT NULL
        AND JSON_EXTRACT(state_json, '$.visualHint') IS NOT NULL
    `);
  },

  async down() {
    // Intencionalmente sem rollback do payload antigo.
  },
};
