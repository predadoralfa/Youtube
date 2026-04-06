"use strict";

function levelTimeMs(level) {
  return 300000 * Math.pow(3, level - 1);
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
        throw new Error("Nao foi possivel localizar a Era 1 para os researches iniciais.");
      }

      const [itemRows] = await queryInterface.sequelize.query(
        `
        SELECT id, code, name, category
        FROM ga_item_def
        WHERE code IN ('FOOD-APPLE', 'SMALL_STONE')
        `,
        { transaction }
      );

      const appleItem = itemRows.find((row) => String(row.code) === "FOOD-APPLE");
      const stoneItem = itemRows.find((row) => String(row.code) === "SMALL_STONE");

      if (!appleItem?.id) {
        throw new Error("Nao foi possivel localizar FOOD-APPLE para seed de research.");
      }

      const defs = [
        {
          code: "RESEARCH_APPLE",
          name: "Apples",
          description: "Study edible fruit and unlock the first practical uses of apples.",
          itemDefId: Number(appleItem.id),
          maxLevel: 5,
          levels: [
            {
              level: 1,
              title: "Edible Basics",
              description: "Unlock eating apples.",
              grants: {
                unlock: ["item.consume:FOOD-APPLE", "macro.auto_food:FOOD-APPLE"],
              },
              requirements: null,
            },
            {
              level: 2,
              title: "Tree Harvesting",
              description: "Unlock collecting apples from trees.",
              grants: { unlock: ["actor.collect:APPLE_TREE"] },
              requirements: { requiresLevel: 1 },
            },
            { level: 3, title: "Apple Crafting I", description: "Prepare the first future crafting techniques that use apples.", grants: { unlock: [] }, requirements: { requiresLevel: 2 } },
            { level: 4, title: "Apple Crafting II", description: "Deepen your understanding of processed apple recipes and advanced use.", grants: { unlock: [] }, requirements: { requiresLevel: 3 } },
            { level: 5, title: "Apple Mastery", description: "Reach full mastery over the known uses of apples in this era.", grants: { unlock: [] }, requirements: { requiresLevel: 4 } },
          ],
        },
        {
          code: "RESEARCH_STONE",
          name: "Stones",
          description: "Study raw stone and unlock the first primitive crafting paths.",
          itemDefId: Number(stoneItem?.id ?? null) || null,
          maxLevel: 5,
          levels: [
            {
              level: 1,
              title: "Primitive Tooling",
              description: "Unlock crafting a hand-thrown stone weapon.",
              grants: {
                unlock: ["recipe.craft:WEAPON-STONE-SLING"],
              },
              requirements: null,
            },
            { level: 2, title: "Stone Handling", description: "Improve knowledge of shaping, sorting, and selecting better stone pieces.", grants: { unlock: [] }, requirements: { requiresLevel: 1 } },
            { level: 3, title: "Stone Crafting I", description: "Unlock the conceptual path for broader stone-based recipes in the future.", grants: { unlock: [] }, requirements: { requiresLevel: 2 } },
            { level: 4, title: "Stone Crafting II", description: "Expand primitive material handling toward sturdier crafted outcomes.", grants: { unlock: [] }, requirements: { requiresLevel: 3 } },
            { level: 5, title: "Stone Mastery", description: "Reach full mastery over the known uses of stone in this era.", grants: { unlock: [] }, requirements: { requiresLevel: 4 } },
          ],
        },
        {
          code: "RESEARCH_PRIMITIVE_SHELTER",
          name: "Primitive Shelter",
          description: "Study the first ideas of protection, cover, and basic survival structures.",
          itemDefId: null,
          maxLevel: 5,
          levels: [
            {
              level: 1,
              title: "Basic Shelter",
              description: "Unlock the builder screen for a primitive sleeping spot.",
              grants: {
                unlock: ["structure.build:PRIMITIVE_SHELTER"],
              },
              requirements: null,
            },
            { level: 2, title: "Weather Protection", description: "Improve your understanding of cover, insulation, and safer resting places.", grants: { unlock: [] }, requirements: { requiresLevel: 1 } },
            { level: 3, title: "Structural Basics", description: "Advance the conceptual path for more stable early constructions.", grants: { unlock: [] }, requirements: { requiresLevel: 2 } },
            { level: 4, title: "Shelter Expansion", description: "Prepare future expansion into larger and more efficient habitations.", grants: { unlock: [] }, requirements: { requiresLevel: 3 } },
            { level: 5, title: "Shelter Mastery", description: "Reach full mastery over primitive shelter theory in this era.", grants: { unlock: [] }, requirements: { requiresLevel: 4 } },
          ],
        },
      ];

      for (const def of defs) {
        const [existingRows] = await queryInterface.sequelize.query(
          `
          SELECT id
          FROM ga_research_def
          WHERE code = :code
          LIMIT 1
          `,
          {
            transaction,
            replacements: { code: def.code },
          }
        );

        let researchDefId = Number(existingRows?.[0]?.id ?? 0) || null;

        if (!researchDefId) {
          await queryInterface.bulkInsert(
            "ga_research_def",
            [
              {
                code: def.code,
                name: def.name,
                description: def.description,
                item_def_id: def.itemDefId,
                era_min_id: eraMinId,
                max_level: def.maxLevel,
                is_active: true,
              },
            ],
            { transaction }
          );

          const [insertedRows] = await queryInterface.sequelize.query(
            `
            SELECT id
            FROM ga_research_def
            WHERE code = :code
            LIMIT 1
            `,
            {
              transaction,
              replacements: { code: def.code },
            }
          );

          researchDefId = Number(insertedRows?.[0]?.id ?? 0) || null;
        } else {
          await queryInterface.bulkUpdate(
            "ga_research_def",
            {
              name: def.name,
              description: def.description,
              item_def_id: def.itemDefId,
              era_min_id: eraMinId,
              max_level: def.maxLevel,
              is_active: true,
            },
            { id: researchDefId },
            { transaction }
          );
        }

        if (!researchDefId) {
          throw new Error(`Nao foi possivel localizar o research ${def.code}.`);
        }

        for (const level of def.levels) {
          const [levelRows] = await queryInterface.sequelize.query(
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

          if (levelRows?.[0]?.id) {
            await queryInterface.bulkUpdate(
              "ga_research_level_def",
              payload,
              { id: levelRows[0].id },
              { transaction }
            );
          } else {
            await queryInterface.bulkInsert("ga_research_level_def", [payload], { transaction });
          }
        }
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [defRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_research_def
        WHERE code IN ('RESEARCH_APPLE', 'RESEARCH_STONE', 'RESEARCH_PRIMITIVE_SHELTER')
        `,
        { transaction }
      );

      const ids = defRows.map((row) => Number(row.id)).filter(Boolean);
      if (ids.length === 0) return;

      await queryInterface.bulkDelete(
        "ga_user_research",
        {
          research_def_id: ids,
        },
        { transaction }
      );

      await queryInterface.bulkDelete(
        "ga_research_level_def",
        {
          research_def_id: ids,
        },
        { transaction }
      );

      await queryInterface.bulkDelete(
        "ga_research_def",
        {
          id: ids,
        },
        { transaction }
      );
    });
  },
};
