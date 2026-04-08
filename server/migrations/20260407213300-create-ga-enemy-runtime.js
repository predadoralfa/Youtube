"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ga_enemy_runtime", {
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
        onDelete: "RESTRICT",
      },
      spawn_def_entry_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ga_spawn_def_entry",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
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
        type: Sequelize.ENUM("ALIVE", "DEAD", "DESPAWNED"),
        allowNull: false,
        defaultValue: "ALIVE",
      },
      pos_x: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false,
      },
      pos_z: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: false,
      },
      yaw: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: true,
      },
      home_x: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: true,
      },
      home_z: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: true,
      },
      spawned_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      dead_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      respawn_at: {
        type: Sequelize.DATE,
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
      ALTER TABLE ga_enemy_runtime
      MODIFY updated_at TIMESTAMP NOT NULL
      DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP;
    `);

    await queryInterface.addIndex("ga_enemy_runtime", ["spawn_point_id"], {
      name: "ix_ga_enemy_runtime_spawn_point",
    });
    await queryInterface.addIndex("ga_enemy_runtime", ["spawn_def_entry_id"], {
      name: "ix_ga_enemy_runtime_spawn_def_entry",
    });
    await queryInterface.addIndex("ga_enemy_runtime", ["enemy_def_id"], {
      name: "ix_ga_enemy_runtime_enemy_def",
    });
    await queryInterface.addIndex("ga_enemy_runtime", ["status"], {
      name: "ix_ga_enemy_runtime_status",
    });
    await queryInterface.addIndex("ga_enemy_runtime", ["respawn_at"], {
      name: "ix_ga_enemy_runtime_respawn_at",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("ga_enemy_runtime", "ix_ga_enemy_runtime_respawn_at").catch(() => {});
    await queryInterface.removeIndex("ga_enemy_runtime", "ix_ga_enemy_runtime_status").catch(() => {});
    await queryInterface.removeIndex("ga_enemy_runtime", "ix_ga_enemy_runtime_enemy_def").catch(() => {});
    await queryInterface.removeIndex("ga_enemy_runtime", "ix_ga_enemy_runtime_spawn_def_entry").catch(() => {});
    await queryInterface.removeIndex("ga_enemy_runtime", "ix_ga_enemy_runtime_spawn_point").catch(() => {});
    await queryInterface.dropTable("ga_enemy_runtime");
  },
};
