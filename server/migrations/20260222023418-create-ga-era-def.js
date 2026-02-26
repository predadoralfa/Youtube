"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ga_era_def", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      code: { type: Sequelize.STRING(64), allowNull: false },
      name: { type: Sequelize.STRING(80), allowNull: false },
      order_index: { type: Sequelize.INTEGER, allowNull: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    });

    await queryInterface.addConstraint("ga_era_def", {
      fields: ["code"],
      type: "unique",
      name: "uq_ga_era_def_code",
    });

    await queryInterface.addConstraint("ga_era_def", {
      fields: ["order_index"],
      type: "unique",
      name: "uq_ga_era_def_order_index",
    });

    // Seed mínimo: Era 1 (você pode editar depois pelo admin)
    await queryInterface.bulkInsert("ga_era_def", [
      { code: "ERA_1", name: "Era 1", order_index: 1, is_active: true },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ga_era_def");
  },
};