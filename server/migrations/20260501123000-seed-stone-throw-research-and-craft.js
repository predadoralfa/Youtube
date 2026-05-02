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
    study_time_ms: level.studyTimeMs,
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
        throw new Error("Nao foi possivel localizar a Era 1 para seedar Stone Throw.");
      }

      const skillDefId = await findIdByCode(queryInterface, transaction, "ga_skill_def", "SKILL_CRAFTING");
      const stoneResearchDefId = await findIdByCode(queryInterface, transaction, "ga_research_def", "RESEARCH_STONE");
      const stoneThrowItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "STONE_THROW");
      const smallStoneItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "SMALL_STONE");

      if (!skillDefId) throw new Error("Nao foi possivel localizar SKILL_CRAFTING.");
      if (!stoneResearchDefId) throw new Error("Nao foi possivel localizar RESEARCH_STONE.");
      if (!stoneThrowItemDefId) throw new Error("Nao foi possivel localizar STONE_THROW.");
      if (!smallStoneItemDefId) throw new Error("Nao foi possivel localizar SMALL_STONE.");

      const researchDefId = await upsertResearchDef(queryInterface, transaction, "RESEARCH_STONE_THROW", {
        name: "Stone Throw",
        description: "Study the throwing form of stone and unlock its craft.",
        item_def_id: stoneThrowItemDefId,
        era_min_id: eraMinId,
        max_level: 1,
        prerequisite_research_def_id: stoneResearchDefId,
        prerequisite_level: 4,
        is_active: true,
      });

      if (!researchDefId) {
        throw new Error("Nao foi possivel seedar RESEARCH_STONE_THROW.");
      }

      await upsertResearchLevel(queryInterface, transaction, researchDefId, {
        level: 1,
        studyTimeMs: 300000,
        title: "Stone Throw Crafting",
        description: "Unlock crafting the Stone Throw weapon.",
        grants: { unlock: ["recipe.craft:CRAFT_STONE_THROW"] },
        requirements: null,
      });

      const craftDefId = await upsertCraft(queryInterface, transaction, "CRAFT_STONE_THROW", {
        name: "Stone Throw",
        description: "Craft a throwable stone weapon.",
        skill_def_id: skillDefId,
        required_skill_level: 1,
        required_research_def_id: researchDefId,
        required_research_level: 1,
        output_item_def_id: stoneThrowItemDefId,
        output_qty: 1,
        craft_time_ms: 120000,
        stamina_cost_total: 10,
        xp_reward: 20,
        is_active: true,
      });

      if (!craftDefId) {
        throw new Error("Nao foi possivel seedar CRAFT_STONE_THROW.");
      }

      await upsertRecipeItem(queryInterface, transaction, craftDefId, smallStoneItemDefId, {
        quantity: 50,
        role: "INPUT",
        sort_order: 1,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const researchDefId = await findIdByCode(queryInterface, transaction, "ga_research_def", "RESEARCH_STONE_THROW");
      if (researchDefId) {
        await queryInterface.bulkDelete(
          "ga_research_level_def",
          { research_def_id: researchDefId },
          { transaction }
        );
        await queryInterface.bulkDelete(
          "ga_user_research",
          { research_def_id: researchDefId },
          { transaction }
        );
        await queryInterface.bulkDelete(
          "ga_research_def",
          { id: researchDefId, code: "RESEARCH_STONE_THROW" },
          { transaction }
        );
      }

      const craftDefId = await findIdByCode(queryInterface, transaction, "ga_craft_def", "CRAFT_STONE_THROW");
      if (craftDefId) {
        await queryInterface.bulkDelete("ga_craft_recipe_item", { craft_def_id: craftDefId }, { transaction });
        await queryInterface.bulkDelete("ga_craft_def", { id: craftDefId, code: "CRAFT_STONE_THROW" }, { transaction });
      }
    });
  },
};
