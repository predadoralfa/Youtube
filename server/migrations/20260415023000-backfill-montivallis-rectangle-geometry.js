"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO ga_local_geometry (local_id, size_x, size_z)
      VALUES (16, 10000, 100000)
      ON DUPLICATE KEY UPDATE
        size_x = VALUES(size_x),
        size_z = VALUES(size_z)
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE ga_local_geometry
      SET size_x = 10000,
          size_z = 10000
      WHERE local_id = 16
    `);
  },
};
