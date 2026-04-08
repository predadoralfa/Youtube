"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ga_spawn_def_component", "quantity", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });

    await queryInterface.addColumn("ga_spawn_def_component", "sort_order", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.sequelize.query(`
      UPDATE ga_spawn_def_component
      SET
        quantity = COALESCE(NULLIF(quantity_max, 0), NULLIF(quantity_min, 0), 1),
        sort_order = COALESCE(sort_order, id)
    `);

    await queryInterface.addIndex("ga_spawn_def_component", ["spawn_def_id", "sort_order"], {
      name: "ix_ga_spawn_def_component_spawn_def_sort_order",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("ga_spawn_def_component", "ix_ga_spawn_def_component_spawn_def_sort_order").catch(() => {});
    await queryInterface.removeColumn("ga_spawn_def_component", "sort_order");
    await queryInterface.removeColumn("ga_spawn_def_component", "quantity");
  },
};
