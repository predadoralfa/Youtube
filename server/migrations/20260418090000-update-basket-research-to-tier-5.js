"use strict";

function levelTimeMs(level) {
  return 420000 * Math.pow(3, level - 1);
}

function fiberCost(level) {
  if (level <= 1) return null;
  return 10 * Math.pow(3, level - 2);
}

function levelRequirements(level) {
  if (level <= 1) return null;
  return {
    requiresLevel: level - 1,
    itemCosts: [
      {
        itemCode: "FIBER",
        qty: fiberCost(level),
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
        throw new Error("Nao foi possivel localizar a Era 1 para atualizar a pesquisa da cesta.");
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
        throw new Error("Nao foi possivel localizar o item BASKET para atualizar a pesquisa.");
      }

      const basketResearchDefId = await upsertResearchDef(queryInterface, transaction, "RESEARCH_BASKET", {
        name: "Basket",
        description: "Study woven baskets to expand early carrying capacity.",
        item_def_id: basketItemDefId,
        era_min_id: eraMinId,
        max_level: 5,
        is_active: true,
      });

      if (!basketResearchDefId) {
        throw new Error("Nao foi possivel atualizar RESEARCH_BASKET.");
      }

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
          description: "Reinforce your basket weaving and prepare the next tier.",
          grants: { unlock: [] },
          requirements: levelRequirements(2),
        },
        {
          level: 3,
          title: "Basket Weaving III",
          description: "Improve basket structure and expand future carrying options.",
          grants: { unlock: [] },
          requirements: levelRequirements(3),
        },
        {
          level: 4,
          title: "Basket Weaving IV",
          description: "Refine the basket framework for heavier loads.",
          grants: { unlock: [] },
          requirements: levelRequirements(4),
        },
        {
          level: 5,
          title: "Basket Mastery",
          description: "Reach the full mastery path for basket handling.",
          grants: { unlock: [] },
          requirements: levelRequirements(5),
        },
      ];

      for (const level of basketLevels) {
        await upsertResearchLevel(queryInterface, transaction, basketResearchDefId, level);
      }
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
          { research_def_id: basketResearchDefId, level: { [queryInterface.sequelize.Sequelize.Op.gte]: 2 } },
          { transaction }
        ).catch(() => {});

        await queryInterface.bulkUpdate(
          "ga_research_def",
          { max_level: 1 },
          { id: basketResearchDefId },
          { transaction }
        );

        await queryInterface.bulkUpdate(
          "ga_research_level_def",
          {
            title: "Basket Weaving",
            description: "Unlock basket crafting and prepare for better carry capacity.",
            grants_json: JSON.stringify({ unlock: ["recipe.craft:BASKET"] }),
            requirements_json: null,
          },
          { research_def_id: basketResearchDefId, level: 1 },
          { transaction }
        );
      }
    });
  },
};
