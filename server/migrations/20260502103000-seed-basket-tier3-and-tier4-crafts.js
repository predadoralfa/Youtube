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

async function upsertByCode(queryInterface, transaction, tableName, code, payload) {
  const id = await findIdByCode(queryInterface, transaction, tableName, code);

  if (!id) {
    await queryInterface.bulkInsert(tableName, [{ code, ...payload }], { transaction });
    return findIdByCode(queryInterface, transaction, tableName, code);
  }

  await queryInterface.bulkUpdate(tableName, payload, { id }, { transaction });
  return id;
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
    await queryInterface.bulkUpdate("ga_craft_recipe_item", row, { id: rows[0].id }, { transaction });
    return;
  }

  await queryInterface.bulkInsert("ga_craft_recipe_item", [row], { transaction });
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const basketResearchDefId = await findIdByCode(queryInterface, transaction, "ga_research_def", "RESEARCH_BASKET");
      const craftingSkillDefId = await findIdByCode(queryInterface, transaction, "ga_skill_def", "SKILL_CRAFTING");
      const fiberItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "FIBER");
      const basketT2ItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "BASKET_T2");
      const basketT3ItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "BASKET_T3");
      const basketT4ItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "BASKET_T4");

      if (!basketResearchDefId) {
        throw new Error("Nao foi possivel localizar RESEARCH_BASKET.");
      }
      if (!craftingSkillDefId) {
        throw new Error("Nao foi possivel localizar SKILL_CRAFTING.");
      }
      if (!fiberItemDefId) {
        throw new Error("Nao foi possivel localizar FIBER.");
      }
      if (!basketT2ItemDefId) {
        throw new Error("Nao foi possivel localizar BASKET_T2.");
      }
      if (!basketT3ItemDefId) {
        throw new Error("Nao foi possivel localizar BASKET_T3.");
      }
      if (!basketT4ItemDefId) {
        throw new Error("Nao foi possivel localizar BASKET_T4.");
      }

      const craftT3Id = await upsertCraft(queryInterface, transaction, "CRAFT_BASKET_T3", {
        name: "Basket Tier 3",
        description: "Weave a reinforced basket tier with extra capacity.",
        skill_def_id: craftingSkillDefId,
        required_skill_level: 3,
        required_research_def_id: basketResearchDefId,
        required_research_level: 4,
        output_item_def_id: basketT3ItemDefId,
        output_qty: 1,
        craft_time_ms: 2700000,
        stamina_cost_total: 45,
        xp_reward: 75,
        is_active: true,
      });

      if (!craftT3Id) {
        throw new Error("Nao foi possivel seedar CRAFT_BASKET_T3.");
      }

      await upsertRecipeItem(queryInterface, transaction, craftT3Id, basketT2ItemDefId, {
        quantity: 1,
        role: "INPUT",
        sort_order: 1,
      });
      await upsertRecipeItem(queryInterface, transaction, craftT3Id, fiberItemDefId, {
        quantity: 45,
        role: "INPUT",
        sort_order: 2,
      });

      const craftT4Id = await upsertCraft(queryInterface, transaction, "CRAFT_BASKET_T4", {
        name: "Basket Tier 4",
        description: "Weave the final reinforced basket tier for heavy loads.",
        skill_def_id: craftingSkillDefId,
        required_skill_level: 4,
        required_research_def_id: basketResearchDefId,
        required_research_level: 5,
        output_item_def_id: basketT4ItemDefId,
        output_qty: 1,
        craft_time_ms: 3600000,
        stamina_cost_total: 60,
        xp_reward: 100,
        is_active: true,
      });

      if (!craftT4Id) {
        throw new Error("Nao foi possivel seedar CRAFT_BASKET_T4.");
      }

      await upsertRecipeItem(queryInterface, transaction, craftT4Id, basketT3ItemDefId, {
        quantity: 1,
        role: "INPUT",
        sort_order: 1,
      });
      await upsertRecipeItem(queryInterface, transaction, craftT4Id, fiberItemDefId, {
        quantity: 60,
        role: "INPUT",
        sort_order: 2,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const code of ["CRAFT_BASKET_T4", "CRAFT_BASKET_T3"]) {
        const craftDefId = await findIdByCode(queryInterface, transaction, "ga_craft_def", code);
        if (!craftDefId) continue;

        await queryInterface.bulkDelete("ga_craft_recipe_item", { craft_def_id: craftDefId }, { transaction });
        await queryInterface.bulkDelete("ga_craft_def", { id: craftDefId }, { transaction });
      }
    });
  },
};
