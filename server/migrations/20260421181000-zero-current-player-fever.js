"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkUpdate(
      "ga_user_stats",
      {
        disease_level: 0,
        disease_severity: 0,
      },
      {
        user_id: 1,
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkUpdate(
      "ga_user_stats",
      {
        disease_level: 100,
        disease_severity: 0,
      },
      {
        user_id: 1,
      }
    );
  },
};
