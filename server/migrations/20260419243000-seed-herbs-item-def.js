"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [[eraRow]] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_era_def
        WHERE order_index = 1
        LIMIT 1
        `,
        { transaction }
      );

      const eraMinId = Number(eraRow?.id ?? 0);
      if (!eraMinId) {
        throw new Error("Nao foi possivel localizar a Era 1 para seed de Herbs.");
      }

      const [rows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_item_def
        WHERE code = 'HERBS'
        LIMIT 1
        `,
        { transaction }
      );

      const payload = {
        code: "HERBS",
        name: "Herbs",
        category: "MATERIAL",
        stack_max: 50,
        unit_weight: 0.05,
        era_min_id: eraMinId,
        is_active: true,
      };

      const itemId = Number(rows?.[0]?.id ?? 0) || null;
      if (!itemId) {
        await queryInterface.bulkInsert("ga_item_def", [payload], { transaction });
        return;
      }

      await queryInterface.bulkUpdate("ga_item_def", payload, { id: itemId }, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete("ga_item_def", { code: "HERBS" }, { transaction });
    });
  },
};
