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

async function updateResearchLevel(queryInterface, transaction, researchDefId, level, payload) {
  const grantsJson = JSON.stringify(payload.grants ?? { unlock: [] });
  const requirementsJson =
    payload.requirements == null ? null : JSON.stringify(payload.requirements ?? {});

  await queryInterface.sequelize.query(
    `
    UPDATE ga_research_level_def
    SET title = :title,
        description = :description,
        grants_json = :grantsJson,
        requirements_json = :requirementsJson,
        study_time_ms = :studyTimeMs
    WHERE research_def_id = :researchDefId
      AND level = :level
    `,
    {
      transaction,
      replacements: {
        researchDefId,
        level,
        title: payload.title ?? null,
        description: payload.description ?? null,
        grantsJson,
        requirementsJson,
        studyTimeMs: Number(payload.studyTimeMs ?? 0),
      },
    }
  );
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const basketResearchDefId = await findIdByCode(
        queryInterface,
        transaction,
        "ga_research_def",
        "RESEARCH_BASKET"
      );
      if (!basketResearchDefId) {
        throw new Error("Nao foi possivel localizar RESEARCH_BASKET.");
      }

      await updateResearchLevel(queryInterface, transaction, basketResearchDefId, 2, {
        title: "Basket Handling",
        description: "Increase the carrying capacity of every basket by 2.5 kg.",
        grants: { unlock: ["container.max_weight_delta:BASKET:2.5"] },
        requirements: { requiresLevel: 1, itemCosts: [] },
        studyTimeMs: 900000,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const basketResearchDefId = await findIdByCode(
        queryInterface,
        transaction,
        "ga_research_def",
        "RESEARCH_BASKET"
      );
      if (!basketResearchDefId) {
        throw new Error("Nao foi possivel localizar RESEARCH_BASKET.");
      }

      await updateResearchLevel(queryInterface, transaction, basketResearchDefId, 2, {
        title: "Basket Handling",
        description: "Reduce the carried weight of each basket by 50 grams.",
        grants: { unlock: ["item.weight_delta:BASKET:-0.05"] },
        requirements: { requiresLevel: 1, itemCosts: [] },
        studyTimeMs: 900000,
      });
    });
  },
};
