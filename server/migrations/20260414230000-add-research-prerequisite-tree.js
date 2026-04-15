"use strict";

function levelTimeMs(level) {
  // Shelter tier 2 starts at 7 minutes and grows x3 per level.
  return 420000 * Math.pow(3, level - 1);
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
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const table = "ga_research_def";

      const describe = await queryInterface.describeTable(table, { transaction }).catch(() => null);
      if (describe && !describe.prerequisite_research_def_id) {
        await queryInterface.addColumn(
          table,
          "prerequisite_research_def_id",
          {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: table, key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
          },
          { transaction }
        );
      }

      if (describe && !describe.prerequisite_level) {
        await queryInterface.addColumn(
          table,
          "prerequisite_level",
          {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 1,
          },
          { transaction }
        );
      }

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
        throw new Error("Nao foi possivel localizar a Era 1 para seed da arvore de research.");
      }

      const [fiberRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_research_def
        WHERE code = 'RESEARCH_FIBER'
        LIMIT 1
        `,
        { transaction }
      );
      const fiberId = Number(fiberRows?.[0]?.id ?? 0) || null;
      if (!fiberId) {
        throw new Error("Nao foi possivel localizar RESEARCH_FIBER para linkar o shelter.");
      }

      const shelterLevels = [
        {
          level: 1,
          title: "Basic Shelter",
          description: "Unlock the builder screen for a primitive sleeping spot.",
          grants: { unlock: ["structure.build:PRIMITIVE_SHELTER"] },
          requirements: null,
        },
        {
          level: 2,
          title: "Weather Protection",
          description: "Improve your understanding of cover, insulation, and safer resting places.",
          grants: { unlock: [] },
          requirements: { requiresLevel: 1 },
        },
        {
          level: 3,
          title: "Structural Basics",
          description: "Advance the conceptual path for more stable early constructions.",
          grants: { unlock: [] },
          requirements: { requiresLevel: 2 },
        },
        {
          level: 4,
          title: "Shelter Expansion",
          description: "Prepare future expansion into larger and more efficient habitations.",
          grants: { unlock: [] },
          requirements: { requiresLevel: 3 },
        },
        {
          level: 5,
          title: "Shelter Mastery",
          description: "Reach full mastery over primitive shelter theory in this era.",
          grants: { unlock: [] },
          requirements: { requiresLevel: 4 },
        },
      ];

      const shelterId = await upsertResearchDef(
        queryInterface,
        transaction,
        "RESEARCH_PRIMITIVE_SHELTER",
        {
          name: "Primitive Shelter",
          description: "Study the first ideas of protection, cover, and basic survival structures.",
          item_def_id: null,
          era_min_id: eraMinId,
          max_level: 5,
          is_active: true,
        }
      );
      if (!shelterId) {
        throw new Error("Nao foi possivel localizar ou seedar RESEARCH_PRIMITIVE_SHELTER.");
      }

      for (const level of shelterLevels) {
        await upsertResearchLevel(queryInterface, transaction, shelterId, level);
      }

      await queryInterface.bulkUpdate(
        table,
        {
          prerequisite_research_def_id: fiberId,
          prerequisite_level: 3,
        },
        { id: shelterId },
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [shelterRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_research_def
        WHERE code = 'RESEARCH_PRIMITIVE_SHELTER'
        LIMIT 1
        `,
        { transaction }
      );

      const shelterId = Number(shelterRows?.[0]?.id ?? 0) || null;
      if (shelterId) {
        await queryInterface.bulkUpdate(
          "ga_research_def",
          {
            prerequisite_research_def_id: null,
            prerequisite_level: 1,
          },
          { id: shelterId },
          { transaction }
        );
      }

      const table = "ga_research_def";
      const describe = await queryInterface.describeTable(table, { transaction }).catch(() => null);
      if (describe && describe.prerequisite_level) {
        await queryInterface.removeColumn(table, "prerequisite_level", { transaction });
      }
      if (describe && describe.prerequisite_research_def_id) {
        await queryInterface.removeColumn(table, "prerequisite_research_def_id", { transaction });
      }
    });
  },
};
