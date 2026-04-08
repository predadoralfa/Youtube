"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ga_spawn_instance_enemy", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      spawn_instance_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ga_spawn_instance",
          key: "id",
        },
      },
      spawn_def_enemy_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ga_spawn_def_enemy",
          key: "id",
        },
      },
      slot_index: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("ALIVE", "DEAD", "DISABLED"),
        allowNull: false,
        defaultValue: "ALIVE",
      },
      hp_current: {
        type: Sequelize.INTEGER,
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
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("ga_spawn_instance_enemy", ["spawn_instance_id"], {
      name: "ix_ga_spawn_instance_enemy_spawn_instance",
    });
    await queryInterface.addIndex("ga_spawn_instance_enemy", ["spawn_def_enemy_id"], {
      name: "ix_ga_spawn_instance_enemy_spawn_def_enemy",
    });
    await queryInterface.addIndex("ga_spawn_instance_enemy", ["status"], {
      name: "ix_ga_spawn_instance_enemy_status",
    });
    await queryInterface.addIndex("ga_spawn_instance_enemy", ["respawn_at"], {
      name: "ix_ga_spawn_instance_enemy_respawn_at",
    });
    await queryInterface.addIndex(
      "ga_spawn_instance_enemy",
      ["spawn_instance_id", "spawn_def_enemy_id", "slot_index"],
      {
        unique: true,
        name: "uq_ga_spawn_instance_enemy_slot",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("ga_spawn_instance_enemy", "uq_ga_spawn_instance_enemy_slot").catch(() => {});
    await queryInterface.removeIndex("ga_spawn_instance_enemy", "ix_ga_spawn_instance_enemy_respawn_at").catch(() => {});
    await queryInterface.removeIndex("ga_spawn_instance_enemy", "ix_ga_spawn_instance_enemy_status").catch(() => {});
    await queryInterface.removeIndex("ga_spawn_instance_enemy", "ix_ga_spawn_instance_enemy_spawn_def_enemy").catch(() => {});
    await queryInterface.removeIndex("ga_spawn_instance_enemy", "ix_ga_spawn_instance_enemy_spawn_instance").catch(() => {});
    await queryInterface.dropTable("ga_spawn_instance_enemy");
  },
};
