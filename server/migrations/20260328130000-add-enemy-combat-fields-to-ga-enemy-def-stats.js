"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ga_enemy_def_stats", "defense", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      after: "attack_speed",
    });

    await queryInterface.addColumn("ga_enemy_def_stats", "attack_range", {
      type: Sequelize.DECIMAL(10, 3),
      allowNull: false,
      defaultValue: 1.2,
      after: "defense",
    });

    await queryInterface.sequelize.query(`
      UPDATE ga_enemy_def_stats
      SET defense = 0,
          attack_range = 1.2
      WHERE defense IS NULL OR attack_range IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("ga_enemy_def_stats", "attack_range");
    await queryInterface.removeColumn("ga_enemy_def_stats", "defense");
  },
};
