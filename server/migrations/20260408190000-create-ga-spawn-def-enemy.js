"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ga_spawn_def_enemy", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      spawn_def_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ga_spawn_def",
          key: "id",
        },
      },
      enemy_def_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ga_enemy_def",
          key: "id",
        },
      },
      status: {
        type: Sequelize.ENUM("ACTIVE", "DISABLED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.addIndex("ga_spawn_def_enemy", ["spawn_def_id"], {
      name: "ix_ga_spawn_def_enemy_spawn_def",
    });
    await queryInterface.addIndex("ga_spawn_def_enemy", ["enemy_def_id"], {
      name: "ix_ga_spawn_def_enemy_enemy_def",
    });
    await queryInterface.addIndex("ga_spawn_def_enemy", ["status"], {
      name: "ix_ga_spawn_def_enemy_status",
    });
    await queryInterface.addIndex("ga_spawn_def_enemy", ["sort_order"], {
      name: "ix_ga_spawn_def_enemy_sort_order",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("ga_spawn_def_enemy", "ix_ga_spawn_def_enemy_sort_order").catch(() => {});
    await queryInterface.removeIndex("ga_spawn_def_enemy", "ix_ga_spawn_def_enemy_status").catch(() => {});
    await queryInterface.removeIndex("ga_spawn_def_enemy", "ix_ga_spawn_def_enemy_enemy_def").catch(() => {});
    await queryInterface.removeIndex("ga_spawn_def_enemy", "ix_ga_spawn_def_enemy_spawn_def").catch(() => {});
    await queryInterface.dropTable("ga_spawn_def_enemy");
  },
};
