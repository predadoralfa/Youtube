"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.dropTable("ga_enemy_runtime_stats");
    await queryInterface.dropTable("ga_enemy_runtime");
    await queryInterface.dropTable("ga_spawn_def_component");
  },

  async down() {
    throw new Error("Down migration not supported for legacy spawn runtime removal.");
  },
};
