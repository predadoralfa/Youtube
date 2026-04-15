"use strict";

function levelTimeMs(level) {
  return 420000 * Math.pow(3, level - 1);
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

async function upsertResearchDef(queryInterface, transaction, code, payload) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_research_def
    WHERE code = :code
    LIMIT 1
    `,
    { transaction, replacements: { code } }
  );

  const id = Number(rows?.[0]?.id ?? 0) || null;
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

    const [insertedRows] = await queryInterface.sequelize.query(
      `
      SELECT id
      FROM ga_research_def
      WHERE code = :code
      LIMIT 1
      `,
      { transaction, replacements: { code } }
    );

    return Number(insertedRows?.[0]?.id ?? 0) || null;
  }

  await queryInterface.bulkUpdate("ga_research_def", payload, { id }, { transaction });
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

      const eraMinId = Number(eraRow?.id ?? 0) || null;
      if (!eraMinId) {
        throw new Error("Nao foi possivel localizar a Era 1 para seed da pesquisa da cesta.");
      }

      const [appleItemRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_item_def
        WHERE code = 'FOOD-APPLE'
        LIMIT 1
        `,
        { transaction }
      );
      const appleItemDefId = Number(appleItemRows?.[0]?.id ?? 0) || null;
      if (!appleItemDefId) {
        throw new Error("Nao foi possivel localizar FOOD-APPLE para atualizar a pesquisa.");
      }

      const [basketItemRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_item_def
        WHERE code = 'BASKET'
        LIMIT 1
        `,
        { transaction }
      );
      const basketItemDefId = Number(basketItemRows?.[0]?.id ?? 0) || null;
      if (!basketItemDefId) {
        throw new Error("Nao foi possivel localizar o item BASKET para seedar a pesquisa.");
      }

      const appleResearchDefId = await upsertResearchDef(queryInterface, transaction, "RESEARCH_APPLE", {
        name: "Apples",
        description: "Study edible fruit and unlock the first practical uses of apples.",
        item_def_id: appleItemDefId,
        era_min_id: eraMinId,
        max_level: 5,
        is_active: true,
      });

      if (!appleResearchDefId) {
        throw new Error("Nao foi possivel seedar RESEARCH_APPLE para atualizar a arvore.");
      }

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
          title: "Branching Path",
          description: "Unlock the basket research branch and continue the apple progression.",
          grants: { unlock: ["item.consume:FOOD-APPLE"] },
          requirements: { requiresLevel: 1, itemCosts: [{ itemCode: "FOOD-APPLE", qty: 10 }] },
        },
        {
          level: 3,
          title: "Orchard Logistics",
          description: "Organize the next apple techniques before automation.",
          grants: { unlock: [] },
          requirements: { requiresLevel: 2, itemCosts: [{ itemCode: "FOOD-APPLE", qty: 30 }] },
        },
        {
          level: 4,
          title: "Auto Food Training",
          description: "Unlock the apple macro for automatic eating.",
          grants: { unlock: ["macro.auto_food:FOOD-APPLE"] },
          requirements: { requiresLevel: 3, itemCosts: [{ itemCode: "FOOD-APPLE", qty: 90 }] },
        },
        {
          level: 5,
          title: "Orchard Refinement",
          description: "Reduce apple weight by 1 gram.",
          grants: { unlock: ["item.weight_delta:FOOD-APPLE:-0.001"] },
          requirements: { requiresLevel: 4, itemCosts: [{ itemCode: "FOOD-APPLE", qty: 270 }] },
        },
      ];

      for (const level of appleLevels) {
        await upsertResearchLevel(queryInterface, transaction, appleResearchDefId, level);
      }

      const basketResearchDefId = await upsertResearchDef(queryInterface, transaction, "RESEARCH_BASKET", {
        name: "Basket",
        description: "Study woven baskets to expand early carrying capacity.",
        item_def_id: basketItemDefId,
        era_min_id: eraMinId,
        max_level: 1,
        is_active: true,
      });

      if (!basketResearchDefId) {
        throw new Error("Nao foi possivel seedar RESEARCH_BASKET.");
      }

      await upsertResearchLevel(queryInterface, transaction, basketResearchDefId, {
        level: 1,
        title: "Basket Weaving",
        description: "Unlock basket crafting and prepare for better carry capacity.",
        grants: { unlock: ["recipe.craft:BASKET"] },
        requirements: null,
      });

      await queryInterface.bulkUpdate(
        "ga_research_def",
        {
          prerequisite_research_def_id: appleResearchDefId,
          prerequisite_level: 2,
        },
        { id: basketResearchDefId },
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [basketRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_research_def
        WHERE code = 'RESEARCH_BASKET'
        LIMIT 1
        `,
        { transaction }
      );
      const basketResearchDefId = Number(basketRows?.[0]?.id ?? 0) || null;

      if (basketResearchDefId) {
        await queryInterface.bulkDelete(
          "ga_research_level_def",
          { research_def_id: basketResearchDefId },
          { transaction }
        );
        await queryInterface.bulkDelete(
          "ga_user_research",
          { research_def_id: basketResearchDefId },
          { transaction }
        );
        await queryInterface.bulkDelete(
          "ga_research_def",
          { id: basketResearchDefId },
          { transaction }
        );
      }

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
        await queryInterface.bulkUpdate(
          "ga_research_level_def",
          {
            title: "Branching Path",
            description: "Unlock the basket research branch and continue the apple progression.",
            grants_json: JSON.stringify({ unlock: ["item.consume:FOOD-APPLE"] }),
            requirements_json: JSON.stringify({ requiresLevel: 1, itemCosts: [{ itemCode: "FOOD-APPLE", qty: 10 }] }),
          },
          { research_def_id: appleResearchDefId, level: 2 },
          { transaction }
        );

        await queryInterface.bulkUpdate(
          "ga_research_level_def",
          {
            title: "Basket Weaving",
            description: "Unlock the first basket craft and the path toward extra hand storage.",
            grants_json: JSON.stringify({ unlock: ["recipe.craft:BASKET"] }),
            requirements_json: JSON.stringify({ requiresLevel: 2, itemCosts: [{ itemCode: "FOOD-APPLE", qty: 30 }] }),
          },
          { research_def_id: appleResearchDefId, level: 3 },
          { transaction }
        );
      }
    });
  },
};
