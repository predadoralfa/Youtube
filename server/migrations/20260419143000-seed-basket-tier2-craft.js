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

async function upsertComponent(queryInterface, transaction, itemDefId, componentType, dataJson, version = 1) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_item_def_component
    WHERE item_def_id = :itemDefId
      AND component_type = :componentType
    LIMIT 1
    `,
    {
      transaction,
      replacements: {
        itemDefId,
        componentType,
      },
    }
  );

  const payload = {
    item_def_id: itemDefId,
    component_type: componentType,
    data_json: dataJson,
    version,
  };

  if (rows?.[0]?.id) {
    await queryInterface.bulkUpdate("ga_item_def_component", payload, { id: rows[0].id }, { transaction });
    return;
  }

  await queryInterface.bulkInsert("ga_item_def_component", [payload], { transaction });
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

async function upsertResearchLevel(queryInterface, transaction, researchDefId, level, payload) {
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
        level,
      },
    }
  );

  const row = {
    research_def_id: researchDefId,
    level,
    study_time_ms: payload.study_time_ms,
    title: payload.title ?? null,
    description: payload.description ?? null,
    grants_json: JSON.stringify(payload.grants ?? { unlock: [] }),
    requirements_json: payload.requirements ? JSON.stringify(payload.requirements) : null,
  };

  if (rows?.[0]?.id) {
    await queryInterface.bulkUpdate("ga_research_level_def", row, { id: rows[0].id }, { transaction });
    return;
  }

  await queryInterface.bulkInsert("ga_research_level_def", [row], { transaction });
}

function researchStudyTimeMs(level) {
  return 420000 * Math.pow(3, level - 1);
}

function basketResearchRequirements(level) {
  if (level <= 1) return null;
  return {
    requiresLevel: level - 1,
    itemCosts: [
      {
        itemCode: "FIBER",
        qty: 10 * Math.pow(3, level - 2),
      },
    ],
  };
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
        throw new Error("Nao foi possivel localizar a Era 1 para seed da cesta Tier 2.");
      }

      const craftingSkillDefId = await findIdByCode(queryInterface, transaction, "ga_skill_def", "SKILL_CRAFTING");
      const basketResearchDefId = await findIdByCode(queryInterface, transaction, "ga_research_def", "RESEARCH_BASKET");
      const basketT1ItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "BASKET");
      const fiberItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "FIBER");
      if (!craftingSkillDefId) {
        throw new Error("Nao foi possivel localizar SKILL_CRAFTING.");
      }
      if (!basketResearchDefId) {
        throw new Error("Nao foi possivel localizar RESEARCH_BASKET.");
      }
      if (!basketT1ItemDefId) {
        throw new Error("Nao foi possivel localizar o item BASKET.");
      }
      if (!fiberItemDefId) {
        throw new Error("Nao foi possivel localizar o item FIBER.");
      }

      const basketT2ItemDefId = await upsertByCode(queryInterface, transaction, "ga_item_def", "BASKET_T2", {
        name: "Basket Tier 2",
        category: "CONTAINER",
        stack_max: 1,
        unit_weight: 0.3,
        era_min_id: eraMinId,
        is_active: true,
      });

      if (!basketT2ItemDefId) {
        throw new Error("Nao foi possivel seedar o item BASKET_T2.");
      }

      await upsertComponent(
        queryInterface,
        transaction,
        basketT2ItemDefId,
        "EQUIPPABLE",
        JSON.stringify({ allowedSlots: ["HAND_L", "HAND_R"] })
      );

      await upsertComponent(
        queryInterface,
        transaction,
        basketT2ItemDefId,
        "GRANTS_CONTAINER",
        JSON.stringify({ containerDefCode: "BASKET_T2" })
      );

      const basketT2ContainerDefId = await upsertByCode(queryInterface, transaction, "ga_container_def", "BASKET_T2", {
        name: "Basket Pouch Tier 2",
        slot_count: 1,
        max_weight: 5,
        allowed_categories_mask: null,
        is_active: true,
      });

      if (!basketT2ContainerDefId) {
        throw new Error("Nao foi possivel seedar o container BASKET_T2.");
      }

      const craftDefId = await upsertCraft(queryInterface, transaction, "CRAFT_BASKET_T2", {
        name: "Basket Tier 2",
        description: "Weave a reinforced basket that carries more weight.",
        skill_def_id: craftingSkillDefId,
        required_skill_level: 2,
        required_research_def_id: basketResearchDefId,
        required_research_level: 2,
        output_item_def_id: basketT2ItemDefId,
        output_qty: 1,
        craft_time_ms: 1800000,
        stamina_cost_total: 30,
        xp_reward: 50,
        is_active: true,
      });

      if (!craftDefId) {
        throw new Error("Nao foi possivel seedar CRAFT_BASKET_T2.");
      }

      await upsertRecipeItem(queryInterface, transaction, craftDefId, basketT1ItemDefId, {
        quantity: 1,
        role: "INPUT",
        sort_order: 1,
      });
      await upsertRecipeItem(queryInterface, transaction, craftDefId, fiberItemDefId, {
        quantity: 30,
        role: "INPUT",
        sort_order: 2,
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
          title: "Basket Weaving II",
          description: "Melhorar a estrutura da cesta para levar mais peso.",
          grants: { unlock: ["recipe.craft:CRAFT_BASKET_T2"] },
          requirements: basketResearchRequirements(2),
        },
      ];

      for (const level of basketLevels) {
        await upsertResearchLevel(queryInterface, transaction, basketResearchDefId, level.level, {
          study_time_ms: researchStudyTimeMs(level.level),
          title: level.title,
          description: level.description,
          grants: level.grants,
          requirements: level.requirements,
        });
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const craftDefId = await findIdByCode(queryInterface, transaction, "ga_craft_def", "CRAFT_BASKET_T2");
      if (craftDefId) {
        await queryInterface.bulkDelete("ga_craft_recipe_item", { craft_def_id: craftDefId }, { transaction });
        await queryInterface.bulkDelete("ga_craft_def", { id: craftDefId }, { transaction });
      }

      const basketT2ItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "BASKET_T2");
      if (basketT2ItemDefId) {
        await queryInterface.bulkDelete(
          "ga_item_def_component",
          { item_def_id: basketT2ItemDefId },
          { transaction }
        );
        await queryInterface.bulkDelete("ga_item_def", { id: basketT2ItemDefId }, { transaction });
      }

      const basketT2ContainerDefId = await findIdByCode(queryInterface, transaction, "ga_container_def", "BASKET_T2");
      if (basketT2ContainerDefId) {
        await queryInterface.bulkDelete("ga_container_def", { id: basketT2ContainerDefId }, { transaction });
      }

      const basketResearchDefId = await findIdByCode(queryInterface, transaction, "ga_research_def", "RESEARCH_BASKET");
      if (basketResearchDefId) {
        await upsertResearchLevel(queryInterface, transaction, basketResearchDefId, 2, {
          study_time_ms: researchStudyTimeMs(2),
          title: "Basket Weaving II",
          description: "Reinforce your basket weaving and prepare the next tier.",
          grants: { unlock: [] },
          requirements: basketResearchRequirements(2),
        });
      }
    });
  },
};
