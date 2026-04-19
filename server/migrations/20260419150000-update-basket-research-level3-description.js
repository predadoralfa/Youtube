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

function levelTimeMs(level) {
  return 420000 * Math.pow(3, level - 1);
}

function levelRequirements(level) {
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
      const basketResearchDefId = await findIdByCode(queryInterface, transaction, "ga_research_def", "RESEARCH_BASKET");
      if (!basketResearchDefId) {
        throw new Error("Nao foi possivel localizar RESEARCH_BASKET.");
      }

      await upsertResearchLevel(queryInterface, transaction, basketResearchDefId, 3, {
        study_time_ms: levelTimeMs(3),
        title: "Basket Weaving III",
        description: "Improve the basket structure to carry more weight.",
        grants: { unlock: [] },
        requirements: levelRequirements(3),
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const basketResearchDefId = await findIdByCode(queryInterface, transaction, "ga_research_def", "RESEARCH_BASKET");
      if (!basketResearchDefId) {
        return;
      }

      await upsertResearchLevel(queryInterface, transaction, basketResearchDefId, 3, {
        study_time_ms: levelTimeMs(3),
        title: "Basket Weaving III",
        description: "Improve basket structure and expand future carrying options.",
        grants: { unlock: [] },
        requirements: levelRequirements(3),
      });
    });
  },
};
