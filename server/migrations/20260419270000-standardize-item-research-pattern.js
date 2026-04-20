"use strict";

function levelTimeMs(level) {
  return 300000 * Math.pow(3, level - 1);
}

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

async function upsertResearchDef(queryInterface, transaction, code, payload) {
  const id = await findIdByCode(queryInterface, transaction, "ga_research_def", code);

  if (!id) {
    await queryInterface.bulkInsert(
      "ga_research_def",
      [
        {
          code,
          ...payload,
        },
      ],
      { transaction }
    );
    return findIdByCode(queryInterface, transaction, "ga_research_def", code);
  }

  await queryInterface.bulkUpdate("ga_research_def", payload, { id }, { transaction });
  return id;
}

async function upsertResearchLevel(queryInterface, transaction, researchDefId, level) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_research_level_def
    WHERE research_def_id = :researchDefId
      AND level = :level
    LIMIT 1
    `,
    {
      transaction,
      replacements: {
        researchDefId,
        level: level.level,
      },
    }
  );

  const payload = {
    research_def_id: researchDefId,
    level: level.level,
    study_time_ms: levelTimeMs(level.level),
    title: level.title ?? null,
    description: level.description ?? null,
    grants_json: JSON.stringify(level.grants ?? { unlock: [] }),
    requirements_json: level.requirements ? JSON.stringify(level.requirements) : null,
  };

  if (rows?.[0]?.id) {
    await queryInterface.bulkUpdate("ga_research_level_def", payload, { id: rows[0].id }, { transaction });
    return;
  }

  await queryInterface.bulkInsert("ga_research_level_def", [payload], { transaction });
}

async function upsertCraftResearchLevel(queryInterface, transaction, code, requiredResearchLevel) {
  const craftDefId = await findIdByCode(queryInterface, transaction, "ga_craft_def", code);
  if (!craftDefId) return;

  await queryInterface.bulkUpdate(
    "ga_craft_def",
    {
      required_research_level: requiredResearchLevel,
    },
    { id: craftDefId },
    { transaction }
  );
}

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

      const eraMinId = Number(eraRow?.id ?? 0) || null;
      if (!eraMinId) {
        throw new Error("Nao foi possivel localizar a Era 1 para padronizar research.");
      }

      const appleItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "FOOD-APPLE");
      const basketItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "BASKET");
      const stoneItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "SMALL_STONE");
      const twigItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "GRAVETO");
      const herbsItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "HERBS");
      const fiberItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "FIBER");

      if (appleItemDefId) {
        const appleResearchDefId = await upsertResearchDef(queryInterface, transaction, "RESEARCH_APPLE", {
          name: "Apples",
          description: "Study edible fruit and unlock the first practical uses of apples.",
          item_def_id: appleItemDefId,
          era_min_id: eraMinId,
          max_level: 5,
          is_active: true,
        });

        const appleLevels = [
          {
            level: 1,
            title: "Orchard Interest",
            description: "Make apples an item of interest and unlock collecting them from trees.",
            grants: { unlock: ["actor.collect:APPLE_TREE"] },
            requirements: null,
          },
          {
            level: 2,
            title: "Apple Handling",
            description: "Reduce the carried weight of each apple by 1 gram.",
            grants: { unlock: ["item.weight_delta:FOOD-APPLE:-0.001"] },
            requirements: { requiresLevel: 1, itemCosts: [] },
          },
          {
            level: 3,
            title: "Apple Consumption",
            description: "Unlock eating apples by hand.",
            grants: { unlock: ["item.consume:FOOD-APPLE"] },
            requirements: { requiresLevel: 2, itemCosts: [] },
          },
          {
            level: 4,
            title: "Auto Food Training",
            description: "Unlock the apple macro for automatic eating.",
            grants: { unlock: ["macro.auto_food:FOOD-APPLE"] },
            requirements: { requiresLevel: 3, itemCosts: [] },
          },
          {
            level: 5,
            title: "Orchard Mastery",
            description: "Reach a balanced mastery state for apple handling.",
            grants: { unlock: [] },
            requirements: { requiresLevel: 4, itemCosts: [] },
          },
        ];

        for (const level of appleLevels) {
          await upsertResearchLevel(queryInterface, transaction, appleResearchDefId, level);
        }
      }

      if (basketItemDefId) {
        const basketResearchDefId = await upsertResearchDef(queryInterface, transaction, "RESEARCH_BASKET", {
          name: "Basket",
          description: "Study woven baskets to expand early carrying capacity.",
          item_def_id: basketItemDefId,
          era_min_id: eraMinId,
          max_level: 5,
          is_active: true,
        });

        const basketLevels = [
          {
            level: 1,
            title: "Basket Weaving I",
            description: "Unlock the first basket craft and the path toward extra hand storage.",
            grants: { unlock: ["recipe.craft:BASKET"] },
            requirements: null,
          },
          {
            level: 2,
            title: "Basket Handling",
            description: "Reduce the carried weight of each basket by 50 grams.",
            grants: { unlock: ["item.weight_delta:BASKET:-0.05"] },
            requirements: { requiresLevel: 1, itemCosts: [] },
          },
          {
            level: 3,
            title: "Basket Weaving III",
            description: "Unlock the reinforced basket craft.",
            grants: { unlock: ["recipe.craft:CRAFT_BASKET_T2"] },
            requirements: { requiresLevel: 2, itemCosts: [] },
          },
          {
            level: 4,
            title: "Basket Weaving IV",
            description: "Refine the basket framework for heavier loads.",
            grants: { unlock: [] },
            requirements: { requiresLevel: 3, itemCosts: [] },
          },
          {
            level: 5,
            title: "Basket Mastery",
            description: "Reach the full mastery path for basket handling.",
            grants: { unlock: [] },
            requirements: { requiresLevel: 4, itemCosts: [] },
          },
        ];

        for (const level of basketLevels) {
          await upsertResearchLevel(queryInterface, transaction, basketResearchDefId, level);
        }

        await upsertCraftResearchLevel(queryInterface, transaction, "CRAFT_BASKET_T2", 3);
      }

      if (stoneItemDefId) {
        const stoneResearchDefId = await upsertResearchDef(queryInterface, transaction, "RESEARCH_STONE", {
          name: "Stones",
          description: "Study raw stone and unlock the first practical uses of stone.",
          item_def_id: stoneItemDefId,
          era_min_id: eraMinId,
          max_level: 5,
          is_active: true,
        });

        const stoneLevels = [
          {
            level: 1,
            title: "Stone Interest",
            description: "Make stone an item of interest and unlock collecting it from rock nodes.",
            grants: { unlock: ["actor.collect:ROCK_NODE_SMALL"] },
            requirements: null,
          },
          {
            level: 2,
            title: "Stone Handling",
            description: "Reduce the carried weight of each small stone by 5 grams.",
            grants: { unlock: ["item.weight_delta:SMALL_STONE:-0.005"] },
            requirements: { requiresLevel: 1, itemCosts: [] },
          },
          {
            level: 3,
            title: "Stone Throwing",
            description: "Unlock crafting the thrown stone weapon.",
            grants: { unlock: ["recipe.craft:WEAPON-STONE-SLING"] },
            requirements: { requiresLevel: 2, itemCosts: [] },
          },
          {
            level: 4,
            title: "Stone Gathering I",
            description: "Reduce the collection time for stone by half a second.",
            grants: { unlock: ["item.collect_time_delta:SMALL_STONE:-500"] },
            requirements: { requiresLevel: 3, itemCosts: [] },
          },
          {
            level: 5,
            title: "Stone Gathering II",
            description: "Reduce the collection time for stone by another half second.",
            grants: { unlock: ["item.collect_time_delta:SMALL_STONE:-500"] },
            requirements: { requiresLevel: 4, itemCosts: [] },
          },
        ];

        for (const level of stoneLevels) {
          await upsertResearchLevel(queryInterface, transaction, stoneResearchDefId, level);
        }
      }

      if (twigItemDefId) {
        const twigResearchDefId = await upsertResearchDef(queryInterface, transaction, "RESEARCH_TWIG", {
          name: "Twigs",
          description: "Study raw twig and unlock the first practical uses of twig.",
          item_def_id: twigItemDefId,
          era_min_id: eraMinId,
          max_level: 5,
          is_active: true,
        });

        const twigLevels = [
          {
            level: 1,
            title: "Twig Interest",
            description: "Make twig an item of interest and unlock collecting it from tree nodes.",
            grants: { unlock: ["actor.collect:TWIG"] },
            requirements: null,
          },
          {
            level: 2,
            title: "Twig Handling",
            description: "Reduce the carried weight of each twig by 5 grams.",
            grants: { unlock: ["item.weight_delta:GRAVETO:-0.005"] },
            requirements: { requiresLevel: 1, itemCosts: [] },
          },
          {
            level: 3,
            title: "Twig Shelter",
            description: "Unlock primitive shelter construction with twigs.",
            grants: { unlock: ["structure.build:PRIMITIVE_SHELTER"] },
            requirements: { requiresLevel: 2, itemCosts: [] },
          },
          {
            level: 4,
            title: "Twig Gathering I",
            description: "Reduce the collection time for twig by half a second.",
            grants: { unlock: ["item.collect_time_delta:GRAVETO:-500"] },
            requirements: { requiresLevel: 3, itemCosts: [] },
          },
          {
            level: 5,
            title: "Twig Gathering II",
            description: "Reduce the collection time for twig by another half second.",
            grants: { unlock: ["item.collect_time_delta:GRAVETO:-500"] },
            requirements: { requiresLevel: 4, itemCosts: [] },
          },
        ];

        for (const level of twigLevels) {
          await upsertResearchLevel(queryInterface, transaction, twigResearchDefId, level);
        }
      }

      if (herbsItemDefId) {
        const herbsResearchDefId = await upsertResearchDef(queryInterface, transaction, "RESEARCH_HERBS", {
          name: "Herbs",
          description: "Study herbs and unlock collecting, lighter carrying, and medical use.",
          item_def_id: herbsItemDefId,
          era_min_id: eraMinId,
          max_level: 3,
          is_active: true,
        });

        const herbsLevels = [
          {
            level: 1,
            title: "Herb Interest",
            description: "Make herbs an item of interest and unlock collecting them from herb patches.",
            grants: { unlock: ["actor.collect:HERBS_PATCH"] },
            requirements: null,
          },
          {
            level: 2,
            title: "Herb Handling",
            description: "Reduce the carried weight of each herb by 5 grams.",
            grants: { unlock: ["item.weight_delta:HERBS:-0.005"] },
            requirements: { requiresLevel: 1, itemCosts: [] },
          },
          {
            level: 3,
            title: "Herbal Medicine",
            description: "Unlock the medical use of herbs.",
            grants: { unlock: ["item.medicate:HERBS"] },
            requirements: { requiresLevel: 2, itemCosts: [] },
          },
        ];

        for (const level of herbsLevels) {
          await upsertResearchLevel(queryInterface, transaction, herbsResearchDefId, level);
        }
      }

      if (fiberItemDefId) {
        const fiberResearchDefId = await findIdByCode(queryInterface, transaction, "ga_research_def", "RESEARCH_FIBER");
        if (fiberResearchDefId) {
          await upsertResearchLevel(queryInterface, transaction, fiberResearchDefId, {
            level: 1,
            title: "Fiber Interest",
            description: "Make fiber an item of interest and unlock collecting it from fiber patches.",
            grants: { unlock: ["actor.collect:FIBER_PATCH"] },
            requirements: null,
          });
          await upsertResearchLevel(queryInterface, transaction, fiberResearchDefId, {
            level: 2,
            title: "Fiber Handling",
            description: "Reduce the carried weight of each fiber bundle by 50 grams.",
            grants: { unlock: ["item.weight_delta:FIBER:-0.05"] },
            requirements: { requiresLevel: 1, itemCosts: [] },
          });
          await upsertResearchLevel(queryInterface, transaction, fiberResearchDefId, {
            level: 3,
            title: "Fiber Basket Crafting",
            description: "Unlock basket crafting as the first major fiber technology.",
            grants: { unlock: ["recipe.craft:BASKET"] },
            requirements: { requiresLevel: 2, itemCosts: [] },
          });
        }
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [appleRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_research_def
        WHERE code = 'RESEARCH_APPLE'
        LIMIT 1
        `,
        { transaction }
      );
      const appleResearchDefId = Number(appleRows?.[0]?.id ?? 0) || null;
      if (appleResearchDefId) {
        await upsertResearchLevel(queryInterface, transaction, appleResearchDefId, {
          level: 1,
          title: "Edible Basics",
          description: "Unlock eating apples by hand.",
          grants: { unlock: ["item.consume:FOOD-APPLE", "macro.auto_food:FOOD-APPLE"] },
          requirements: null,
        });
        await upsertResearchLevel(queryInterface, transaction, appleResearchDefId, {
          level: 2,
          title: "Tree Harvesting",
          description: "Unlock collecting apples from trees.",
          grants: { unlock: ["actor.collect:APPLE_TREE"] },
          requirements: { requiresLevel: 1, itemCosts: [] },
        });
        await upsertResearchLevel(queryInterface, transaction, appleResearchDefId, {
          level: 3,
          title: "Apple Crafting I",
          description: "Prepare the first future crafting techniques that use apples.",
          grants: { unlock: [] },
          requirements: { requiresLevel: 2, itemCosts: [] },
        });
        await upsertResearchLevel(queryInterface, transaction, appleResearchDefId, {
          level: 4,
          title: "Apple Crafting II",
          description: "Deepen your understanding of processed apple recipes and advanced use.",
          grants: { unlock: [] },
          requirements: { requiresLevel: 3, itemCosts: [] },
        });
        await upsertResearchLevel(queryInterface, transaction, appleResearchDefId, {
          level: 5,
          title: "Apple Mastery",
          description: "Reach full mastery over the known uses of apples in this era.",
          grants: { unlock: [] },
          requirements: { requiresLevel: 4, itemCosts: [] },
        });
      }

      const basketResearchDefId = await findIdByCode(queryInterface, transaction, "ga_research_def", "RESEARCH_BASKET");
      if (basketResearchDefId) {
        await upsertResearchLevel(queryInterface, transaction, basketResearchDefId, {
          level: 1,
          title: "Basket Weaving I",
          description: "Unlock the first basket craft and the path toward extra hand storage.",
          grants: { unlock: ["recipe.craft:BASKET"] },
          requirements: null,
        });
        await upsertResearchLevel(queryInterface, transaction, basketResearchDefId, {
          level: 2,
          title: "Basket Weaving II",
          description: "Reinforce your basket weaving and prepare the next tier.",
          grants: { unlock: ["recipe.craft:CRAFT_BASKET_T2"] },
          requirements: { requiresLevel: 1, itemCosts: [] },
        });
        await upsertResearchLevel(queryInterface, transaction, basketResearchDefId, {
          level: 3,
          title: "Basket Weaving III",
          description: "Improve basket structure and expand future carrying options.",
          grants: { unlock: [] },
          requirements: { requiresLevel: 2, itemCosts: [] },
        });
        await upsertResearchLevel(queryInterface, transaction, basketResearchDefId, {
          level: 4,
          title: "Basket Weaving IV",
          description: "Refine the basket framework for heavier loads.",
          grants: { unlock: [] },
          requirements: { requiresLevel: 3, itemCosts: [] },
        });
        await upsertResearchLevel(queryInterface, transaction, basketResearchDefId, {
          level: 5,
          title: "Basket Mastery",
          description: "Reach the full mastery path for basket handling.",
          grants: { unlock: [] },
          requirements: { requiresLevel: 4, itemCosts: [] },
        });
      }

      const twigResearchDefId = await findIdByCode(queryInterface, transaction, "ga_research_def", "RESEARCH_TWIG");
      if (twigResearchDefId) {
        await upsertResearchLevel(queryInterface, transaction, twigResearchDefId, {
          level: 1,
          title: "Twig Interest",
          description: "Make twig an item of interest and unlock collecting it from tree nodes.",
          grants: { unlock: ["actor.collect:TWIG"] },
          requirements: null,
        });
        await upsertResearchLevel(queryInterface, transaction, twigResearchDefId, {
          level: 2,
          title: "Twig Handling",
          description: "Reduce the carried weight of each twig by 5 grams.",
          grants: { unlock: ["item.weight_delta:GRAVETO:-0.005"] },
          requirements: { requiresLevel: 1, itemCosts: [] },
        });
        await upsertResearchLevel(queryInterface, transaction, twigResearchDefId, {
          level: 3,
          title: "Twig Crafting I",
          description: "Unlock the conceptual path for future twig-based recipes.",
          grants: { unlock: [] },
          requirements: { requiresLevel: 2, itemCosts: [] },
        });
        await upsertResearchLevel(queryInterface, transaction, twigResearchDefId, {
          level: 4,
          title: "Twig Gathering I",
          description: "Reduce the collection time for twig by half a second.",
          grants: { unlock: ["item.collect_time_delta:GRAVETO:-500"] },
          requirements: { requiresLevel: 3, itemCosts: [] },
        });
        await upsertResearchLevel(queryInterface, transaction, twigResearchDefId, {
          level: 5,
          title: "Twig Gathering II",
          description: "Reduce the collection time for twig by another half second.",
          grants: { unlock: ["item.collect_time_delta:GRAVETO:-500"] },
          requirements: { requiresLevel: 4, itemCosts: [] },
        });
      }
    });
  },
};
