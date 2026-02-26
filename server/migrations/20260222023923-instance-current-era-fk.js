"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // garante que existe uma era padrão (order_index = 1)
    const [[era1]] = await queryInterface.sequelize.query(`
      SELECT id FROM ga_era_def WHERE order_index = 1 LIMIT 1
    `);
    if (!era1?.id) {
      throw new Error("Era 1 não encontrada em ga_era_def (order_index=1).");
    }

    await queryInterface.addColumn("ga_instance", "current_era_id", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: era1.id, // importante para linhas já existentes
    });

    await queryInterface.addIndex("ga_instance", ["current_era_id"], {
      name: "idx_ga_instance_current_era_id",
    });

    await queryInterface.addConstraint("ga_instance", {
      fields: ["current_era_id"],
      type: "foreign key",
      name: "fk_ga_instance_current_era_id",
      references: { table: "ga_era_def", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint("ga_instance", "fk_ga_instance_current_era_id");
    await queryInterface.removeIndex("ga_instance", "idx_ga_instance_current_era_id");
    await queryInterface.removeColumn("ga_instance", "current_era_id");
  },
};