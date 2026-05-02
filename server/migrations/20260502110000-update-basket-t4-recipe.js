"use strict";

async function findIdByCode(queryInterface, transaction, tableName, code) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ${tableName}
    WHERE code = :code
    LIMIT 1
    `,
    { transaction, replacements: { code } }
  );

  return Number(rows?.[0]?.id ?? 0) || null;
}

async function upsertRecipeItem(queryInterface, transaction, craftDefId, itemDefId, payload) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_craft_recipe_item
    WHERE craft_def_id = :craftDefId
      AND item_def_id = :itemDefId
      AND role = :role
    LIMIT 1
    `,
    {
      transaction,
      replacements: {
        craftDefId,
        itemDefId,
        role: payload.role,
      },
    }
  );

  const row = {
    craft_def_id: craftDefId,
    item_def_id: itemDefId,
    ...payload,
  };

  if (rows?.[0]?.id) {
    await queryInterface.bulkUpdate("ga_craft_recipe_item", row, { id: rows[0].id }, { transaction });
    return;
  }

  await queryInterface.bulkInsert("ga_craft_recipe_item", [row], { transaction });
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const craftDefId = await findIdByCode(queryInterface, transaction, "ga_craft_def", "CRAFT_BASKET_T4");
      const fiberItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "FIBER");
      const twigItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "GRAVETO");

      if (!craftDefId) {
        throw new Error("Nao foi possivel localizar CRAFT_BASKET_T4.");
      }
      if (!fiberItemDefId) {
        throw new Error("Nao foi possivel localizar FIBER.");
      }
      if (!twigItemDefId) {
        throw new Error("Nao foi possivel localizar GRAVETO.");
      }

      await queryInterface.bulkDelete("ga_craft_recipe_item", { craft_def_id: craftDefId }, { transaction });

      await upsertRecipeItem(queryInterface, transaction, craftDefId, fiberItemDefId, {
        quantity: 20,
        role: "INPUT",
        sort_order: 1,
      });
      await upsertRecipeItem(queryInterface, transaction, craftDefId, twigItemDefId, {
        quantity: 10,
        role: "INPUT",
        sort_order: 2,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const craftDefId = await findIdByCode(queryInterface, transaction, "ga_craft_def", "CRAFT_BASKET_T4");
      const basketT3ItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "BASKET_T3");
      const fiberItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "FIBER");

      if (!craftDefId) {
        throw new Error("Nao foi possivel localizar CRAFT_BASKET_T4.");
      }
      if (!basketT3ItemDefId) {
        throw new Error("Nao foi possivel localizar BASKET_T3.");
      }
      if (!fiberItemDefId) {
        throw new Error("Nao foi possivel localizar FIBER.");
      }

      await queryInterface.bulkDelete("ga_craft_recipe_item", { craft_def_id: craftDefId }, { transaction });

      await upsertRecipeItem(queryInterface, transaction, craftDefId, basketT3ItemDefId, {
        quantity: 1,
        role: "INPUT",
        sort_order: 1,
      });
      await upsertRecipeItem(queryInterface, transaction, craftDefId, fiberItemDefId, {
        quantity: 60,
        role: "INPUT",
        sort_order: 2,
      });
    });
  },
};
