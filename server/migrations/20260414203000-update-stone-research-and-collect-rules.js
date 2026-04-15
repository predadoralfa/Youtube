"use strict";

function levelTimeMs(level) {
  return 300000 * Math.pow(3, level - 1);
}

function stoneCost(level) {
  if (level <= 1) return null;
  return 10 * Math.pow(3, level - 2);
}

function levelRequirements(level) {
  if (level <= 1) return null;

  return {
    requiresLevel: level - 1,
    itemCosts: [
      {
        itemCode: "SMALL_STONE",
        qty: stoneCost(level),
      },
    ],
  };
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
  } else {
    await queryInterface.bulkInsert("ga_research_level_def", [payload], { transaction });
  }
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

      const eraMinId = Number(eraRow?.id ?? 0);
      if (!eraMinId) {
        throw new Error("Nao foi possivel localizar a Era 1 para atualizar o research de stone.");
      }

      const [stoneRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_item_def
        WHERE code = 'SMALL_STONE'
        LIMIT 1
        `,
        { transaction }
      );

      const stoneItemDefId = Number(stoneRows?.[0]?.id ?? 0) || null;
      if (!stoneItemDefId) {
        throw new Error("Nao foi possivel localizar SMALL_STONE para atualizar o research.");
      }

      const [defRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_research_def
        WHERE code = 'RESEARCH_STONE'
        LIMIT 1
        `,
        { transaction }
      );

      let researchDefId = Number(defRows?.[0]?.id ?? 0) || null;
      const defPayload = {
        code: "RESEARCH_STONE",
        name: "Stones",
        description: "Study raw stone and unlock the first practical uses of stone.",
        item_def_id: stoneItemDefId,
        era_min_id: eraMinId,
        max_level: 5,
        is_active: true,
      };

      if (!researchDefId) {
        await queryInterface.bulkInsert("ga_research_def", [defPayload], { transaction });
        const [insertedRows] = await queryInterface.sequelize.query(
          `
          SELECT id
          FROM ga_research_def
          WHERE code = 'RESEARCH_STONE'
          LIMIT 1
          `,
          { transaction }
        );
        researchDefId = Number(insertedRows?.[0]?.id ?? 0) || null;
      } else {
        await queryInterface.bulkUpdate("ga_research_def", defPayload, { id: researchDefId }, { transaction });
      }

      if (!researchDefId) {
        throw new Error("Nao foi possivel seedar o research RESEARCH_STONE.");
      }

      const levels = [
        {
          level: 1,
          title: "Stone Interest",
          description: "Make stone an item of interest and unlock collecting it from rock nodes.",
          grants: {
            unlock: ["actor.collect:ROCK_NODE_SMALL"],
          },
          requirements: null,
        },
        {
          level: 2,
          title: "Stone Handling",
          description: "Reduce the carried weight of each small stone by 5 grams.",
          grants: {
            unlock: ["item.weight_delta:SMALL_STONE:-0.005"],
          },
          requirements: levelRequirements(2),
        },
        {
          level: 3,
          title: "Stone Throwing",
          description: "Unlock crafting the thrown stone weapon.",
          grants: {
            unlock: ["recipe.craft:WEAPON-STONE-SLING"],
          },
          requirements: levelRequirements(3),
        },
        {
          level: 4,
          title: "Stone Gathering I",
          description: "Reduce the collection time for stone by half a second.",
          grants: {
            unlock: ["item.collect_time_delta:SMALL_STONE:-500"],
          },
          requirements: levelRequirements(4),
        },
        {
          level: 5,
          title: "Stone Gathering II",
          description: "Reduce the collection time for stone by another half second.",
          grants: {
            unlock: ["item.collect_time_delta:SMALL_STONE:-500"],
          },
          requirements: levelRequirements(5),
        },
      ];

      for (const level of levels) {
        await upsertResearchLevel(queryInterface, transaction, researchDefId, level);
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [defRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_research_def
        WHERE code = 'RESEARCH_STONE'
        LIMIT 1
        `,
        { transaction }
      );

      const researchDefId = Number(defRows?.[0]?.id ?? 0) || null;
      if (!researchDefId) return;

      const levels = [
        {
          level: 1,
          title: "Primitive Tooling",
          description: "Unlock crafting a hand-thrown stone weapon.",
          grants: { unlock: ["recipe.craft:WEAPON-STONE-SLING"] },
          requirements: null,
        },
        {
          level: 2,
          title: "Stone Handling",
          description: "Improve knowledge of shaping, sorting, and selecting better stone pieces.",
          grants: { unlock: [] },
          requirements: { requiresLevel: 1 },
        },
        {
          level: 3,
          title: "Stone Crafting I",
          description: "Unlock the conceptual path for broader stone-based recipes in the future.",
          grants: { unlock: [] },
          requirements: { requiresLevel: 2 },
        },
        {
          level: 4,
          title: "Stone Crafting II",
          description: "Expand primitive material handling toward sturdier crafted outcomes.",
          grants: { unlock: [] },
          requirements: { requiresLevel: 3 },
        },
        {
          level: 5,
          title: "Stone Mastery",
          description: "Reach full mastery over the known uses of stone in this era.",
          grants: { unlock: [] },
          requirements: { requiresLevel: 4 },
        },
      ];

      for (const level of levels) {
        await upsertResearchLevel(queryInterface, transaction, researchDefId, level);
      }
    });
  },
};
