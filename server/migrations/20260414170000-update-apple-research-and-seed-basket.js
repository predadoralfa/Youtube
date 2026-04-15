"use strict";

function levelTimeMs(level) {
  return 300000 * Math.pow(3, level - 1);
}

function appleCost(level) {
  if (level <= 1) return null;
  return 10 * Math.pow(3, level - 2);
}

function levelRequirements(level) {
  if (level <= 1) return null;
  return {
    requiresLevel: level - 1,
    itemCosts: [
      {
        itemCode: "FOOD-APPLE",
        qty: appleCost(level),
      },
    ],
  };
}

async function upsertResearchLevel(queryInterface, transaction, researchDefId, level) {
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
    await queryInterface.bulkUpdate("ga_research_level_def", payload, { id: levelRows[0].id }, { transaction });
  } else {
    await queryInterface.bulkInsert("ga_research_level_def", [payload], { transaction });
  }
}

async function upsertByCode(queryInterface, transaction, tableName, code, payload) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ${tableName}
    WHERE code = :code
    LIMIT 1
    `,
    { transaction, replacements: { code } }
  );

  const id = Number(rows?.[0]?.id ?? 0) || null;
  if (!id) {
    await queryInterface.bulkInsert(tableName, [payload], { transaction });
    const [insertedRows] = await queryInterface.sequelize.query(
      `
      SELECT id
      FROM ${tableName}
      WHERE code = :code
      LIMIT 1
      `,
      { transaction, replacements: { code } }
    );
    return Number(insertedRows?.[0]?.id ?? 0) || null;
  }

  await queryInterface.bulkUpdate(tableName, payload, { id }, { transaction });
  return id;
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
        throw new Error("Nao foi possivel localizar a Era 1 para atualizar o research.");
      }

      const [appleRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_item_def
        WHERE code = 'FOOD-APPLE'
        LIMIT 1
        `,
        { transaction }
      );

      const appleItemDefId = Number(appleRows?.[0]?.id ?? 0) || null;
      if (!appleItemDefId) {
        throw new Error("Nao foi possivel localizar FOOD-APPLE para atualizar o research.");
      }

      const [defRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_research_def
        WHERE code = 'RESEARCH_APPLE'
        LIMIT 1
        `,
        { transaction }
      );

      let researchDefId = Number(defRows?.[0]?.id ?? 0) || null;
      const defPayload = {
        code: "RESEARCH_APPLE",
        name: "Apples",
        description: "Study edible fruit and unlock the first practical uses of apples.",
        item_def_id: appleItemDefId,
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
          WHERE code = 'RESEARCH_APPLE'
          LIMIT 1
          `,
          { transaction }
        );
        researchDefId = Number(insertedRows?.[0]?.id ?? 0) || null;
      } else {
        await queryInterface.bulkUpdate("ga_research_def", defPayload, { id: researchDefId }, { transaction });
      }

      if (!researchDefId) {
        throw new Error("Nao foi possivel seedar o research RESEARCH_APPLE.");
      }

      const levels = [
        {
          level: 1,
          title: "Orchard Interest",
          description: "Make apples an item of interest and unlock collecting them from trees.",
          grants: { unlock: ["actor.collect:APPLE_TREE"] },
          requirements: null,
        },
        {
          level: 2,
          title: "Edible Basics",
          description: "Unlock eating apples by hand.",
          grants: { unlock: ["item.consume:FOOD-APPLE"] },
          requirements: levelRequirements(2),
        },
        {
          level: 3,
          title: "Basket Weaving",
          description: "Unlock the first basket craft and the path toward extra hand storage.",
          grants: { unlock: ["recipe.craft:BASKET"] },
          requirements: levelRequirements(3),
        },
        {
          level: 4,
          title: "Auto Food Training",
          description: "Unlock the apple macro for automatic eating.",
          grants: { unlock: ["macro.auto_food:FOOD-APPLE"] },
          requirements: levelRequirements(4),
        },
        {
          level: 5,
          title: "Orchard Refinement",
          description: "Reduce apple weight by 1 gram.",
          grants: { unlock: ["item.weight_delta:FOOD-APPLE:-0.001"] },
          requirements: levelRequirements(5),
        },
      ];

      for (const level of levels) {
        await upsertResearchLevel(queryInterface, transaction, researchDefId, level);
      }

      await upsertByCode(
        queryInterface,
        transaction,
        "ga_container_def",
        "BASKET",
        {
          code: "BASKET",
          name: "Basket Pouch",
          slot_count: 2,
          max_weight: 10,
          allowed_categories_mask: null,
          is_active: true,
        }
      );

      const basketItemDefId = await upsertByCode(
        queryInterface,
        transaction,
        "ga_item_def",
        "BASKET",
        {
          code: "BASKET",
          name: "Basket",
          category: "CONTAINER",
          stack_max: 1,
          unit_weight: 0.3,
          era_min_id: eraMinId,
          is_active: true,
        }
      );

      if (!basketItemDefId) {
        throw new Error("Nao foi possivel seedar o item BASKET.");
      }

      const basketComponents = [
        {
          component_type: "EQUIPPABLE",
          data_json: JSON.stringify({ allowedSlots: ["HAND_L", "HAND_R"] }),
          version: 1,
        },
        {
          component_type: "GRANTS_CONTAINER",
          data_json: JSON.stringify({ containerDefCode: "BASKET" }),
          version: 1,
        },
      ];

      for (const component of basketComponents) {
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
              itemDefId: basketItemDefId,
              componentType: component.component_type,
            },
          }
        );

        const payload = {
          item_def_id: basketItemDefId,
          component_type: component.component_type,
          data_json: component.data_json,
          version: component.version,
        };

        if (rows?.[0]?.id) {
          await queryInterface.bulkUpdate("ga_item_def_component", payload, { id: rows[0].id }, { transaction });
        } else {
          await queryInterface.bulkInsert("ga_item_def_component", [payload], { transaction });
        }
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [basketRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_item_def
        WHERE code = 'BASKET'
        LIMIT 1
        `,
        { transaction }
      );

      const basketItemId = Number(basketRows?.[0]?.id ?? 0) || null;
      if (basketItemId) {
        await queryInterface.bulkDelete("ga_item_def_component", { item_def_id: basketItemId }, { transaction });
        await queryInterface.bulkDelete("ga_item_def", { id: basketItemId }, { transaction });
      }

      await queryInterface.bulkDelete("ga_container_def", { code: "BASKET" }, { transaction });
    });
  },
};
