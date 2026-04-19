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
    study_time_ms: 300000 * Math.pow(3, level.level - 1),
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

function twigCost(level) {
  if (level <= 1) return null;
  return 10 * Math.pow(3, level - 2);
}

function twigRequirements(level) {
  if (level <= 1) return null;
  return {
    requiresLevel: level - 1,
    itemCosts: [
      {
        itemCode: "GRAVETO",
        qty: twigCost(level),
      },
    ],
  };
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const itemTable = await queryInterface.describeTable("ga_item_def").catch(() => null);
      if (itemTable && !Object.prototype.hasOwnProperty.call(itemTable, "asset_key")) {
        await queryInterface.addColumn(
          "ga_item_def",
          "asset_key",
          {
            type: Sequelize.STRING(255),
            allowNull: true,
            after: "name",
          },
          { transaction }
        );
      }

      const twigItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "GRAVETO");
      if (!twigItemDefId) {
        throw new Error("Nao foi possivel localizar o item GRAVETO.");
      }

      await queryInterface.bulkUpdate(
        "ga_item_def",
        {
          asset_key: "Twig.glb",
        },
        { id: twigItemDefId },
        { transaction }
      );

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
        throw new Error("Nao foi possivel localizar a Era 1 para o research de twig.");
      }

      const defPayload = {
        code: "RESEARCH_TWIG",
        name: "Twigs",
        description: "Study raw twig and unlock the first practical uses of twig.",
        item_def_id: twigItemDefId,
        era_min_id: eraMinId,
        max_level: 5,
        is_active: true,
      };

      const [defRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_research_def
        WHERE code = 'RESEARCH_TWIG'
        LIMIT 1
        `,
        { transaction }
      );

      let researchDefId = Number(defRows?.[0]?.id ?? 0) || null;
      if (!researchDefId) {
        await queryInterface.bulkInsert("ga_research_def", [defPayload], { transaction });
        researchDefId = await findIdByCode(queryInterface, transaction, "ga_research_def", "RESEARCH_TWIG");
      } else {
        await queryInterface.bulkUpdate("ga_research_def", defPayload, { id: researchDefId }, { transaction });
      }

      if (!researchDefId) {
        throw new Error("Nao foi possivel seedar o research RESEARCH_TWIG.");
      }

      const levels = [
        {
          level: 1,
          title: "Twig Interest",
          description: "Make twig an item of interest and unlock collecting it from tree nodes.",
          grants: {
            unlock: ["actor.collect:TWIG"],
          },
          requirements: null,
        },
        {
          level: 2,
          title: "Twig Handling",
          description: "Reduce the carried weight of each twig by 5 grams.",
          grants: {
            unlock: ["item.weight_delta:GRAVETO:-0.005"],
          },
          requirements: twigRequirements(2),
        },
        {
          level: 3,
          title: "Twig Crafting I",
          description: "Unlock the conceptual path for future twig-based recipes.",
          grants: { unlock: [] },
          requirements: twigRequirements(3),
        },
        {
          level: 4,
          title: "Twig Gathering I",
          description: "Reduce the collection time for twig by half a second.",
          grants: {
            unlock: ["item.collect_time_delta:GRAVETO:-500"],
          },
          requirements: twigRequirements(4),
        },
        {
          level: 5,
          title: "Twig Gathering II",
          description: "Reduce the collection time for twig by another half second.",
          grants: {
            unlock: ["item.collect_time_delta:GRAVETO:-500"],
          },
          requirements: twigRequirements(5),
        },
      ];

      for (const level of levels) {
        await upsertResearchLevel(queryInterface, transaction, researchDefId, level);
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const researchDefId = await findIdByCode(queryInterface, transaction, "ga_research_def", "RESEARCH_TWIG");
      if (researchDefId) {
        await queryInterface.bulkDelete("ga_research_level_def", { research_def_id: researchDefId }, { transaction });
        await queryInterface.bulkDelete("ga_research_def", { id: researchDefId }, { transaction });
      }

      const twigItemDefId = await findIdByCode(queryInterface, transaction, "ga_item_def", "GRAVETO");
      if (twigItemDefId) {
        await queryInterface.bulkUpdate(
          "ga_item_def",
          {
            asset_key: null,
          },
          { id: twigItemDefId },
          { transaction }
        );
      }

      const itemTable = await queryInterface.describeTable("ga_item_def").catch(() => null);
      if (itemTable && Object.prototype.hasOwnProperty.call(itemTable, "asset_key")) {
        await queryInterface.removeColumn("ga_item_def", "asset_key", { transaction });
      }
    });
  },
};
