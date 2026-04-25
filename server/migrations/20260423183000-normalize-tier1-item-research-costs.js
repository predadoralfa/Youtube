"use strict";

function levelTimeMs(level) {
  return 300000 * Math.pow(3, level - 1);
}

function buildRequirements(itemCode, level) {
  if (level <= 1) return null;
  return {
    requiresLevel: level - 1,
    itemCosts: [
      {
        itemCode,
        qty: level * 10,
      },
    ],
  };
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
    await queryInterface.bulkInsert("ga_research_def", [{ code, ...payload }], { transaction });
    return findIdByCode(queryInterface, transaction, "ga_research_def", code);
  }

  await queryInterface.bulkUpdate("ga_research_def", payload, { id }, { transaction });
  return id;
}

async function upsertResearchLevel(queryInterface, transaction, researchDefId, levelDef, itemCode) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id, title, description, grants_json
    FROM ga_research_level_def
    WHERE research_def_id = :researchDefId
      AND level = :level
    LIMIT 1
    `,
    {
      transaction,
      replacements: {
        researchDefId,
        level: levelDef.level,
      },
    }
  );

  const payload = {
    research_def_id: researchDefId,
    level: levelDef.level,
    study_time_ms: levelTimeMs(levelDef.level),
    requirements_json: buildRequirements(itemCode, levelDef.level)
      ? JSON.stringify(buildRequirements(itemCode, levelDef.level))
      : null,
  };

  if (rows?.[0]?.id) {
    await queryInterface.bulkUpdate("ga_research_level_def", payload, { id: rows[0].id }, { transaction });
    return;
  }

  await queryInterface.bulkInsert(
    "ga_research_level_def",
    [
      {
        ...payload,
        title: levelDef.title ?? rows?.[0]?.title ?? null,
        description: levelDef.description ?? rows?.[0]?.description ?? null,
        grants_json: JSON.stringify(levelDef.grants ?? { unlock: [] }),
      },
    ],
    { transaction }
  );
}

function buildFallbackLevels(spec) {
  return [
    {
      level: 1,
      title: spec.level1Title,
      description: spec.level1Description,
      grants: { unlock: [spec.level1Unlock] },
    },
    {
      level: 2,
      title: spec.level2Title,
      description: spec.level2Description,
      grants: { unlock: [spec.level2Unlock] },
    },
    {
      level: 3,
      title: spec.level3Title,
      description: spec.level3Description,
      grants: { unlock: [spec.level3Unlock] },
    },
    {
      level: 4,
      title: spec.level4Title,
      description: spec.level4Description,
      grants: { unlock: spec.level4Unlock ?? [] },
    },
    {
      level: 5,
      title: spec.level5Title,
      description: spec.level5Description,
      grants: { unlock: spec.level5Unlock ?? [] },
    },
  ];
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
        throw new Error("Nao foi possivel localizar a Era 1 para padronizar research de tier 1.");
      }

      const specs = [
        {
          code: "RESEARCH_APPLE",
          itemCode: "FOOD-APPLE",
          name: "Apples",
          description: "Study edible fruit and unlock the first practical uses of apples.",
          maxLevel: 5,
          level1Title: "Edible Basics",
          level1Description: "Unlock eating apples and collecting them from trees.",
          level1Unlock: "actor.collect:APPLE_TREE",
          level2Title: "Apple Handling",
          level2Description: "Reduce the carried weight of each apple by 1 gram.",
          level2Unlock: "item.weight_delta:FOOD-APPLE:-0.001",
          level3Title: "Apple Consumption",
          level3Description: "Unlock eating apples by hand.",
          level3Unlock: "item.consume:FOOD-APPLE",
          level4Title: "Auto Food Training",
          level4Description: "Unlock the apple macro for automatic eating.",
          level4Unlock: ["macro.auto_food:FOOD-APPLE"],
          level5Title: "Orchard Mastery",
          level5Description: "Reach a balanced mastery state for apple handling.",
          level5Unlock: [],
        },
        {
          code: "RESEARCH_STONE",
          itemCode: "SMALL_STONE",
          name: "Stones",
          description: "Study raw stone and unlock the first practical uses of stone.",
          maxLevel: 5,
          level1Title: "Stone Interest",
          level1Description: "Make stone an item of interest and unlock collecting it from rock nodes.",
          level1Unlock: "actor.collect:ROCK_NODE_SMALL",
          level2Title: "Stone Handling",
          level2Description: "Reduce the carried weight of each small stone by 5 grams.",
          level2Unlock: "item.weight_delta:SMALL_STONE:-0.005",
          level3Title: "Stone Throwing",
          level3Description: "Unlock crafting the thrown stone weapon.",
          level3Unlock: "recipe.craft:WEAPON-STONE-SLING",
          level4Title: "Stone Gathering I",
          level4Description: "Reduce the collection time for stone by half a second.",
          level4Unlock: ["item.collect_time_delta:SMALL_STONE:-500"],
          level5Title: "Stone Gathering II",
          level5Description: "Reduce the collection time for stone by another half second.",
          level5Unlock: ["item.collect_time_delta:SMALL_STONE:-500"],
        },
        {
          code: "RESEARCH_TWIG",
          itemCode: "GRAVETO",
          name: "Twigs",
          description: "Study raw twig and unlock the first practical uses of twig.",
          maxLevel: 5,
          level1Title: "Twig Interest",
          level1Description: "Make twig an item of interest and unlock collecting it from tree nodes.",
          level1Unlock: "actor.collect:TWIG_PATCH",
          level2Title: "Twig Handling",
          level2Description: "Reduce the carried weight of each twig by 5 grams.",
          level2Unlock: "item.weight_delta:GRAVETO:-0.005",
          level3Title: "Twig Shelter",
          level3Description: "Unlock primitive shelter construction with twigs.",
          level3Unlock: "structure.build:PRIMITIVE_SHELTER",
          level4Title: "Twig Gathering I",
          level4Description: "Reduce the collection time for twig by half a second.",
          level4Unlock: ["item.collect_time_delta:GRAVETO:-500"],
          level5Title: "Twig Gathering II",
          level5Description: "Reduce the collection time for twig by another half second.",
          level5Unlock: ["item.collect_time_delta:GRAVETO:-500"],
        },
        {
          code: "RESEARCH_FIBER",
          itemCode: "FIBER",
          name: "Fibers",
          description: "Study fiber and unlock the first practical uses of fiber.",
          maxLevel: 5,
          level1Title: "Fiber Interest",
          level1Description: "Make fiber an item of interest and unlock collecting it from fiber patches.",
          level1Unlock: "actor.collect:FIBER_PATCH",
          level2Title: "Fiber Handling",
          level2Description: "Reduce the carried weight of each fiber bundle by 50 grams.",
          level2Unlock: "item.weight_delta:FIBER:-0.05",
          level3Title: "Fiber Basket Crafting",
          level3Description: "Unlock basket crafting as the first major fiber technology.",
          level3Unlock: "recipe.craft:BASKET",
          level4Title: "Fiber Refinement I",
          level4Description: "Refine the fiber study path.",
          level4Unlock: [],
          level5Title: "Fiber Mastery",
          level5Description: "Reach mastery over fiber in this era.",
          level5Unlock: [],
        },
        {
          code: "RESEARCH_HERBS",
          itemCode: "HERBS",
          name: "Herbs",
          description: "Study herbs and unlock collecting, lighter carrying, and medical use.",
          maxLevel: 5,
          level1Title: "Herb Interest",
          level1Description: "Make herbs an item of interest and unlock collecting them from herb patches.",
          level1Unlock: "actor.collect:HERBS_PATCH",
          level2Title: "Herb Handling",
          level2Description: "Reduce the carried weight of each herb by 5 grams.",
          level2Unlock: "item.weight_delta:HERBS:-0.005",
          level3Title: "Herbal Medicine",
          level3Description: "Unlock the medical use of herbs.",
          level3Unlock: "item.medicate:HERBS",
          level4Title: "Herb Refinement I",
          level4Description: "Refine the herb study path.",
          level4Unlock: [],
          level5Title: "Herb Mastery",
          level5Description: "Reach mastery over herbs in this era.",
          level5Unlock: [],
        },
      ];

      for (const spec of specs) {
        const researchDefId = await upsertResearchDef(queryInterface, transaction, spec.code, {
          name: spec.name,
          description: spec.description,
          item_def_id: await findIdByCode(queryInterface, transaction, "ga_item_def", spec.itemCode),
          era_min_id: eraMinId,
          max_level: spec.maxLevel,
          is_active: true,
        });

        const levels = buildFallbackLevels(spec);
        for (const levelDef of levels) {
          await upsertResearchLevel(queryInterface, transaction, researchDefId, levelDef, spec.itemCode);
        }
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const revertSpecs = [
        {
          code: "RESEARCH_APPLE",
          itemCode: "FOOD-APPLE",
          maxLevel: 5,
          levels: [
            { level: 1, requirements: null },
            { level: 2, requirements: null },
            { level: 3, requirements: null },
            { level: 4, requirements: null },
            { level: 5, requirements: null },
          ],
        },
        {
          code: "RESEARCH_STONE",
          itemCode: "SMALL_STONE",
          maxLevel: 5,
          levels: [
            { level: 1, requirements: null },
            { level: 2, requirements: null },
            { level: 3, requirements: null },
            { level: 4, requirements: null },
            { level: 5, requirements: null },
          ],
        },
        {
          code: "RESEARCH_TWIG",
          itemCode: "GRAVETO",
          maxLevel: 5,
          levels: [
            { level: 1, requirements: null },
            { level: 2, requirements: null },
            { level: 3, requirements: null },
            { level: 4, requirements: null },
            { level: 5, requirements: null },
          ],
        },
        {
          code: "RESEARCH_FIBER",
          itemCode: "FIBER",
          maxLevel: 5,
          levels: [
            { level: 1, requirements: null },
            { level: 2, requirements: null },
            { level: 3, requirements: null },
            { level: 4, requirements: null },
            { level: 5, requirements: null },
          ],
        },
        {
          code: "RESEARCH_HERBS",
          itemCode: "HERBS",
          maxLevel: 5,
          levels: [
            { level: 1, requirements: null },
            { level: 2, requirements: null },
            { level: 3, requirements: null },
            { level: 4, requirements: null },
            { level: 5, requirements: null },
          ],
        },
      ];

      for (const spec of revertSpecs) {
        const researchDefId = await findIdByCode(queryInterface, transaction, "ga_research_def", spec.code);
        if (!researchDefId) continue;

        for (const levelDef of spec.levels) {
          const [rows] = await queryInterface.sequelize.query(
            `
            SELECT id, title, description, grants_json
            FROM ga_research_level_def
            WHERE research_def_id = :researchDefId
              AND level = :level
            LIMIT 1
            `,
            {
              transaction,
              replacements: {
                researchDefId,
                level: levelDef.level,
              },
            }
          );

          const payload = {
            research_def_id: researchDefId,
            level: levelDef.level,
            study_time_ms: levelTimeMs(levelDef.level),
            requirements_json: null,
          };

          if (rows?.[0]?.id) {
            await queryInterface.bulkUpdate("ga_research_level_def", payload, { id: rows[0].id }, { transaction });
          } else {
            await queryInterface.bulkInsert(
              "ga_research_level_def",
              [
                {
                  ...payload,
                  title: levelDef.title ?? rows?.[0]?.title ?? null,
                  description: levelDef.description ?? rows?.[0]?.description ?? null,
                  grants_json: rows?.[0]?.grants_json ?? JSON.stringify({ unlock: [] }),
                },
              ],
              { transaction }
            );
          }
        }

        if (spec.code === "RESEARCH_FIBER" || spec.code === "RESEARCH_HERBS") {
          await queryInterface.bulkUpdate(
            "ga_research_def",
            { max_level: 5 },
            { id: researchDefId },
            { transaction }
          );
        }
      }
    });
  },
};
