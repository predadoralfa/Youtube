"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ga_spawn_def", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      code: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("ACTIVE", "DISABLED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
      spawn_kind: {
        type: Sequelize.ENUM("ENEMY"),
        allowNull: false,
        defaultValue: "ENEMY",
      },
      shape_kind: {
        type: Sequelize.ENUM("POINT", "CIRCLE"),
        allowNull: false,
        defaultValue: "POINT",
      },
      radius: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: true,
      },
      max_alive: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      respawn_ms: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30000,
      },
      patrol_radius: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 5,
      },
      patrol_wait_ms: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 10000,
      },
      patrol_stop_radius: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 0.5,
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
      ALTER TABLE ga_spawn_def
      MODIFY updated_at TIMESTAMP NOT NULL
      DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP;
    `);

    await queryInterface.addIndex("ga_spawn_def", ["code"], {
      name: "ux_ga_spawn_def_code",
      unique: true,
    });

    await queryInterface.addIndex("ga_spawn_def", ["status"], {
      name: "ix_ga_spawn_def_status",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("ga_spawn_def", "ix_ga_spawn_def_status").catch(() => {});
    await queryInterface.removeIndex("ga_spawn_def", "ux_ga_spawn_def_code").catch(() => {});
    await queryInterface.dropTable("ga_spawn_def");
  },
};
