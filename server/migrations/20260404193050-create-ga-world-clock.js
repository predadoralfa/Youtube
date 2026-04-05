"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ga_world_clock", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      anchor_real_ms: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },

      anchor_world_hours: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },

      time_factor: {
        type: Sequelize.DOUBLE,
        allowNull: false,
        defaultValue: 3,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE ga_world_clock
      MODIFY updated_at TIMESTAMP NOT NULL
      DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP;
    `);

    await queryInterface.bulkInsert("ga_world_clock", [
      {
        anchor_real_ms: 1767236400000,
        anchor_world_hours: 0,
        time_factor: 3,
        created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
        updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ga_world_clock");
  },
};
