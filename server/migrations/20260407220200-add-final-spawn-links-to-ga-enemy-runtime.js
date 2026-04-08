"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ga_enemy_runtime", "spawn_instance_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "ga_spawn_instance",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
      after: "id",
    });

    await queryInterface.addColumn("ga_enemy_runtime", "spawn_def_component_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "ga_spawn_def_component",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
      after: "spawn_instance_id",
    });

    await queryInterface.addIndex("ga_enemy_runtime", ["spawn_instance_id"], {
      name: "ix_ga_enemy_runtime_spawn_instance",
    });
    await queryInterface.addIndex("ga_enemy_runtime", ["spawn_def_component_id"], {
      name: "ix_ga_enemy_runtime_spawn_def_component",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("ga_enemy_runtime", "ix_ga_enemy_runtime_spawn_def_component").catch(() => {});
    await queryInterface.removeIndex("ga_enemy_runtime", "ix_ga_enemy_runtime_spawn_instance").catch(() => {});
    await queryInterface.removeColumn("ga_enemy_runtime", "spawn_def_component_id");
    await queryInterface.removeColumn("ga_enemy_runtime", "spawn_instance_id");
  },
};
