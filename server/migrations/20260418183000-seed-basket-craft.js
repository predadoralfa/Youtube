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

async function upsertCraft(queryInterface, transaction, code, payload) {
  const id = await findIdByCode(queryInterface, transaction, "ga_craft_def", code);

  if (!id) {
    await queryInterface.bulkInsert(
      "ga_craft_def",
      [
        {
          code,
          ...payload,
        },
      ],
      { transaction }
    );
    return findIdByCode(queryInterface, transaction, "ga_craft_def", code);
  }

  await queryInterface.bulkUpdate("ga_craft_def", payload, { id }, { transaction });
  return id;
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
    await queryInterface.bulkUpdate(
      "ga_craft_recipe_item",
      row,
      { id: rows[0].id },
      { transaction }
    );
    return;
  }

  await queryInterface.bulkInsert("ga_craft_recipe_item", [row], { transaction });
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const skillDefId = await findIdByCode(queryInterface, transaction, "ga_skill_def", "SKILL_CRAFTING");
      const basketResearchDefId = await findIdByCode(
        queryInterface,
        transaction,
        "ga_research_def",
        "RESEARCH_BASKET"
      );
      const basketItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "BASKET");
      const fiberItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "FIBER");

      if (!skillDefId) throw new Error("Nao foi possivel localizar SKILL_CRAFTING.");
      if (!basketResearchDefId) throw new Error("Nao foi possivel localizar RESEARCH_BASKET.");
      if (!basketItemDefId) throw new Error("Nao foi possivel localizar BASKET.");
      if (!fiberItemDefId) throw new Error("Nao foi possivel localizar FIBER.");

      const craftDefId = await upsertCraft(queryInterface, transaction, "CRAFT_BASKET", {
        name: "Basket",
        description: "Weave fiber into a small hand basket.",
        skill_def_id: skillDefId,
        required_skill_level: 1,
        required_research_def_id: basketResearchDefId,
        required_research_level: 1,
        output_item_def_id: basketItemDefId,
        output_qty: 1,
        craft_time_ms: 30000,
        stamina_cost_total: 8,
        xp_reward: 15,
        is_active: true,
      });

      if (!craftDefId) throw new Error("Nao foi possivel seedar CRAFT_BASKET.");

      await upsertRecipeItem(queryInterface, transaction, craftDefId, fiberItemDefId, {
        quantity: 8,
        role: "INPUT",
        sort_order: 1,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const craftDefId = await findIdByCode(queryInterface, transaction, "ga_craft_def", "CRAFT_BASKET");
      if (!craftDefId) return;
      await queryInterface.bulkDelete("ga_craft_recipe_item", { craft_def_id: craftDefId }, { transaction });
      await queryInterface.bulkDelete("ga_craft_def", { id: craftDefId }, { transaction });
    });
  },
};
