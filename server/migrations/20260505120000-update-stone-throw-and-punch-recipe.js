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

async function updateRecipeQuantity(queryInterface, transaction, craftCode, quantity) {
  const craftDefId = await findIdByCode(queryInterface, transaction, "ga_craft_def", craftCode);
  const stoneItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "SMALL_STONE");

  if (!craftDefId) {
    throw new Error(`Nao foi possivel localizar ${craftCode}.`);
  }

  if (!stoneItemDefId) {
    throw new Error("Nao foi possivel localizar SMALL_STONE.");
  }

  await upsertRecipeItem(queryInterface, transaction, craftDefId, stoneItemDefId, {
    quantity,
    role: "INPUT",
    sort_order: 1,
  });
}

module.exports = {
  async up(queryInterface) {
      await queryInterface.sequelize.transaction(async (transaction) => {
      await updateRecipeQuantity(queryInterface, transaction, "CRAFT_STONE_THROW", 50);
      await updateRecipeQuantity(queryInterface, transaction, "CRAFT_STONE_PUNCH", 50);
      });
    },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await updateRecipeQuantity(queryInterface, transaction, "CRAFT_STONE_THROW", 50);
      await updateRecipeQuantity(queryInterface, transaction, "CRAFT_STONE_PUNCH", 50);
    });
  },
};
