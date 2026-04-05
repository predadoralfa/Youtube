"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [itemRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_item_def
        WHERE code = 'FOOD-APPLE'
        LIMIT 1
        `,
        { transaction }
      );

      const appleItemDefId = itemRows?.[0]?.id ?? null;
      if (!appleItemDefId) {
        throw new Error("Nao foi possivel localizar ga_item_def FOOD-APPLE.");
      }

      const [componentRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_item_def_component
        WHERE item_def_id = ${Number(appleItemDefId)}
          AND component_type = 'CONSUMABLE'
        LIMIT 1
        `,
        { transaction }
      );

      if (componentRows?.[0]?.id) {
        await queryInterface.bulkUpdate(
          "ga_item_def_component",
          {
            data_json: JSON.stringify({
              consumeTimeMs: 60000,
              cooldownMs: 60000,
              effects: [
                {
                  type: "RESTORE_HUNGER",
                  value: 10,
                },
              ],
              buffs: [],
            }),
            version: 1,
          },
          {
            id: componentRows[0].id,
          },
          { transaction }
        );
        return;
      }

      await queryInterface.bulkInsert(
        "ga_item_def_component",
        [
          {
            item_def_id: appleItemDefId,
            component_type: "CONSUMABLE",
            data_json: JSON.stringify({
              consumeTimeMs: 60000,
              cooldownMs: 60000,
              effects: [
                {
                  type: "RESTORE_HUNGER",
                  value: 10,
                },
              ],
              buffs: [],
            }),
            version: 1,
          },
        ],
        { transaction }
      );
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [itemRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_item_def
        WHERE code = 'FOOD-APPLE'
        LIMIT 1
        `,
        { transaction }
      );

      const appleItemDefId = itemRows?.[0]?.id ?? null;
      if (!appleItemDefId) {
        return;
      }

      await queryInterface.bulkDelete(
        "ga_item_def_component",
        {
          item_def_id: appleItemDefId,
          component_type: "CONSUMABLE",
        },
        { transaction }
      );
    });
  },
};
