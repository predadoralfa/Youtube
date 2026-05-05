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

async function updateResearchRequirements(queryInterface, transaction, researchCode, requirementsJson) {
  const researchDefId = await findIdByCode(queryInterface, transaction, "ga_research_def", researchCode);
  if (!researchDefId) {
    throw new Error(`Nao foi possivel localizar ${researchCode}.`);
  }

  await queryInterface.bulkUpdate(
    "ga_research_level_def",
    {
      requirements_json: requirementsJson,
    },
    {
      research_def_id: researchDefId,
      level: 1,
    },
    { transaction }
  );
}

async function updateCraftStoneCost(queryInterface, transaction, craftCode, quantity) {
  const craftDefId = await findIdByCode(queryInterface, transaction, "ga_craft_def", craftCode);
  const stoneItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "SMALL_STONE");

  if (!craftDefId) {
    throw new Error(`Nao foi possivel localizar ${craftCode}.`);
  }

  if (!stoneItemDefId) {
    throw new Error("Nao foi possivel localizar SMALL_STONE.");
  }

  await queryInterface.bulkUpdate(
    "ga_craft_recipe_item",
    {
      quantity,
    },
    {
      craft_def_id: craftDefId,
      item_def_id: stoneItemDefId,
      role: "INPUT",
    },
    { transaction }
  );
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const requirementsJson = JSON.stringify({
        itemCosts: [{ itemCode: "SMALL_STONE", qty: 40 }],
      });

      await updateResearchRequirements(queryInterface, transaction, "RESEARCH_STONE_THROW", requirementsJson);
      await updateResearchRequirements(queryInterface, transaction, "RESEARCH_STONE_PUNCH", requirementsJson);
      await updateCraftStoneCost(queryInterface, transaction, "CRAFT_STONE_THROW", 50);
      await updateCraftStoneCost(queryInterface, transaction, "CRAFT_STONE_PUNCH", 50);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await updateResearchRequirements(queryInterface, transaction, "RESEARCH_STONE_THROW", null);
      await updateResearchRequirements(queryInterface, transaction, "RESEARCH_STONE_PUNCH", null);
      await updateCraftStoneCost(queryInterface, transaction, "CRAFT_STONE_THROW", 90);
      await updateCraftStoneCost(queryInterface, transaction, "CRAFT_STONE_PUNCH", 90);
    });
  },
};
