"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1) adiciona coluna nova
    await queryInterface.addColumn("ga_item_def", "era_min_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // 2) cria eras no catálogo conforme os valores existentes em era_min
    // Obs: assume que era_min era "order_index" (1,2,3...).
    // Se era_min tiver outro significado, aqui muda.
    const [rows] = await queryInterface.sequelize.query(`
      SELECT DISTINCT era_min AS order_index
      FROM ga_item_def
      WHERE era_min IS NOT NULL
      ORDER BY era_min ASC
    `);

    // garante que a Era 1 existe (seed anterior já cria, mas ok)
    // insere eras faltantes
    for (const r of rows) {
      const orderIndex = Number(r.order_index);
      if (!Number.isFinite(orderIndex)) continue;

      await queryInterface.sequelize.query(
        `
        INSERT IGNORE INTO ga_era_def (code, name, order_index, is_active)
        VALUES (?, ?, ?, 1)
        `,
        {
          replacements: [`ERA_${orderIndex}`, `Era ${orderIndex}`, orderIndex],
        }
      );
    }

    // 3) preenche era_min_id por join com ga_era_def.order_index
    await queryInterface.sequelize.query(`
      UPDATE ga_item_def i
      JOIN ga_era_def e ON e.order_index = i.era_min
      SET i.era_min_id = e.id
      WHERE i.era_min IS NOT NULL
    `);

    // 4) remove coluna antiga
    await queryInterface.removeColumn("ga_item_def", "era_min");

    // 5) cria FK + index
    await queryInterface.addIndex("ga_item_def", ["era_min_id"], {
      name: "idx_ga_item_def_era_min_id",
    });

    await queryInterface.addConstraint("ga_item_def", {
      fields: ["era_min_id"],
      type: "foreign key",
      name: "fk_ga_item_def_era_min_id",
      references: { table: "ga_era_def", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface, Sequelize) {
    // reverte: recria era_min, copia order_index, remove FK/coluna era_min_id
    await queryInterface.addColumn("ga_item_def", "era_min", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // precisa remover constraint e index antes
    await queryInterface.removeConstraint("ga_item_def", "fk_ga_item_def_era_min_id");
    await queryInterface.removeIndex("ga_item_def", "idx_ga_item_def_era_min_id");

    // preencher era_min a partir da era referenciada
    await queryInterface.sequelize.query(`
      UPDATE ga_item_def i
      LEFT JOIN ga_era_def e ON e.id = i.era_min_id
      SET i.era_min = e.order_index
      WHERE i.era_min_id IS NOT NULL
    `);

    await queryInterface.removeColumn("ga_item_def", "era_min_id");
  },
};