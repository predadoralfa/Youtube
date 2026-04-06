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
        throw new Error("Nao foi possivel localizar a Era 1 para seedar MATERIAL-STONE.");
      }

      const [itemRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_item_def
        WHERE code = 'MATERIAL-STONE'
        LIMIT 1
        `,
        { transaction }
      );

      const itemDefId = Number(itemRows?.[0]?.id ?? 0) || null;

      const payload = {
        code: "MATERIAL-STONE",
        name: "Stone",
        category: "MATERIAL",
        stack_max: 50,
        unit_weight: 0.4,
        era_min_id: eraMinId,
        is_active: true,
      };

      if (!itemDefId) {
        await queryInterface.bulkInsert("ga_item_def", [payload], { transaction });
      } else {
        await queryInterface.bulkUpdate(
          "ga_item_def",
          {
            name: payload.name,
            category: payload.category,
            stack_max: payload.stack_max,
            unit_weight: payload.unit_weight,
            era_min_id: payload.era_min_id,
            is_active: payload.is_active,
          },
          { id: itemDefId },
          { transaction }
        );
      }

      const [stoneRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_item_def
        WHERE code = 'MATERIAL-STONE'
        LIMIT 1
        `,
        { transaction }
      );

      const stoneItemDefId = Number(stoneRows?.[0]?.id ?? 0) || null;
      if (!stoneItemDefId) {
        throw new Error("Nao foi possivel localizar MATERIAL-STONE apos seed.");
      }

      await queryInterface.sequelize.query(
        `
        UPDATE ga_research_def
        SET item_def_id = :stoneItemDefId
        WHERE code = 'RESEARCH_STONE'
        `,
        {
          transaction,
          replacements: { stoneItemDefId },
        }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        UPDATE ga_research_def
        SET item_def_id = NULL
        WHERE code = 'RESEARCH_STONE'
        `,
        { transaction }
      );

      await queryInterface.bulkDelete(
        "ga_item_def",
        { code: "MATERIAL-STONE" },
        { transaction }
      );
    });
  },
};
