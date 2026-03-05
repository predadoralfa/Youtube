"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      "ga_user_stats",
      "collect_cooldown_ms",
      {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1000,
        comment: "Cooldown em milissegundos entre coletas de actors (ex: BAU)",
      }
    );

    // Criar índice para futuras otimizações (se necessário)
    await queryInterface.addIndex("ga_user_stats", ["collect_cooldown_ms"], {
      name: "ga_user_stats_collect_cooldown_ms",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "ga_user_stats",
      "ga_user_stats_collect_cooldown_ms"
    );
    await queryInterface.removeColumn("ga_user_stats", "collect_cooldown_ms");
  },
};