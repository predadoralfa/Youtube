"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ga_spawn_entry", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      spawn_point_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ga_spawn_point",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      enemy_def_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ga_enemy_def",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      status: {
        type: Sequelize.ENUM("ACTIVE", "DISABLED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },

      weight: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },

      quantity_min: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },

      quantity_max: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },

      alive_limit: {
        type: Sequelize.INTEGER,
        allowNull: true,
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
      ALTER TABLE ga_spawn_entry
      MODIFY updated_at TIMESTAMP NOT NULL
      DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP;
    `);

    await queryInterface.addIndex("ga_spawn_entry", ["spawn_point_id"], {
      name: "ix_ga_spawn_entry_spawn_point",
    });

    await queryInterface.addIndex("ga_spawn_entry", ["enemy_def_id"], {
      name: "ix_ga_spawn_entry_enemy_def",
    });

    await queryInterface.addIndex("ga_spawn_entry", ["status"], {
      name: "ix_ga_spawn_entry_status",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "ga_spawn_entry",
      "ix_ga_spawn_entry_status"
    ).catch(() => {});

    await queryInterface.removeIndex(
      "ga_spawn_entry",
      "ix_ga_spawn_entry_enemy_def"
    ).catch(() => {});

    await queryInterface.removeIndex(
      "ga_spawn_entry",
      "ix_ga_spawn_entry_spawn_point"
    ).catch(() => {});

    await queryInterface.dropTable("ga_spawn_entry");
  },
};