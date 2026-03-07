"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ga_spawn_point", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      instance_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ga_instance",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
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

      pos_x: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false,
      },

      pos_z: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false,
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
      ALTER TABLE ga_spawn_point
      MODIFY updated_at TIMESTAMP NOT NULL
      DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP;
    `);

    await queryInterface.addIndex("ga_spawn_point", ["instance_id"], {
      name: "ix_ga_spawn_point_instance",
    });

    await queryInterface.addIndex("ga_spawn_point", ["status"], {
      name: "ix_ga_spawn_point_status",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "ga_spawn_point",
      "ix_ga_spawn_point_status"
    ).catch(() => {});

    await queryInterface.removeIndex(
      "ga_spawn_point",
      "ix_ga_spawn_point_instance"
    ).catch(() => {});

    await queryInterface.dropTable("ga_spawn_point");
  },
};