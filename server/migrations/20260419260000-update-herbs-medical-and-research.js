"use strict";

function levelTimeMs(level) {
  return 300000 * Math.pow(3, level - 1);
}

async function findSingleId(queryInterface, transaction, sql, replacements = {}) {
  const [rows] = await queryInterface.sequelize.query(sql, { transaction, replacements });
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
    study_time_ms: levelTimeMs(level.level),
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

async function upsertItemComponent(queryInterface, transaction, itemDefId, payload) {
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
        componentType: payload.component_type,
      },
    }
  );

  if (rows?.[0]?.id) {
    await queryInterface.bulkUpdate("ga_item_def_component", payload, { id: rows[0].id }, { transaction });
    return rows[0].id;
  }

  await queryInterface.bulkInsert("ga_item_def_component", [payload], { transaction });
  return findSingleId(
    queryInterface,
    transaction,
    `
    SELECT id
    FROM ga_item_def_component
    WHERE item_def_id = :itemDefId
      AND component_type = :componentType
    LIMIT 1
    `,
    {
      itemDefId,
      componentType: payload.component_type,
    }
  );
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        ALTER TABLE ga_item_def
        MODIFY COLUMN category ENUM('CONSUMABLE', 'FOOD', 'EQUIP', 'AMMO', 'MATERIAL', 'QUEST', 'CONTAINER', 'MISC', 'MEDICINE')
        NOT NULL DEFAULT 'MISC'
        `,
        { transaction }
      );

      const [itemRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_item_def
        WHERE code = 'HERBS'
        LIMIT 1
        `,
        { transaction }
      );

      const herbsItemDefId = Number(itemRows?.[0]?.id ?? 0) || null;
      if (!herbsItemDefId) {
        throw new Error("Nao foi possivel localizar HERBS para atualizar como medicina.");
      }

      await queryInterface.bulkUpdate(
        "ga_item_def",
        {
          name: "Herbs",
          category: "MEDICINE",
          stack_max: 50,
          unit_weight: 0.05,
        },
        { id: herbsItemDefId },
        { transaction }
      );

      await upsertItemComponent(queryInterface, transaction, herbsItemDefId, {
        item_def_id: herbsItemDefId,
        component_type: "CONSUMABLE",
        data_json: JSON.stringify({
          consumeTimeMs: 3000,
          cooldownMs: 0,
          effects: [
            {
              type: "RESTORE_HP",
              value: 20,
            },
          ],
        }),
        version: 1,
      });

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
        throw new Error("Nao foi possivel localizar a Era 1 para o research de Herbs.");
      }

      const [defRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_research_def
        WHERE code = 'RESEARCH_HERBS'
        LIMIT 1
        `,
        { transaction }
      );

      const defPayload = {
        code: "RESEARCH_HERBS",
        name: "Herbs",
        description: "Study herbs and unlock collecting, lighter carrying, and medical use.",
        item_def_id: herbsItemDefId,
        era_min_id: eraMinId,
        max_level: 3,
        is_active: true,
      };

      let researchDefId = Number(defRows?.[0]?.id ?? 0) || null;
      if (!researchDefId) {
        await queryInterface.bulkInsert("ga_research_def", [defPayload], { transaction });
        researchDefId = await findSingleId(
          queryInterface,
          transaction,
          `
          SELECT id
          FROM ga_research_def
          WHERE code = 'RESEARCH_HERBS'
          LIMIT 1
          `
        );
      } else {
        await queryInterface.bulkUpdate("ga_research_def", defPayload, { id: researchDefId }, { transaction });
      }

      if (!researchDefId) {
        throw new Error("Nao foi possivel seedar o research RESEARCH_HERBS.");
      }

      const levels = [
        {
          level: 1,
          title: "Herb Interest",
          description: "Make herbs an item of interest and unlock collecting them from herb patches.",
          grants: { unlock: ["actor.collect:HERBS_PATCH"] },
          requirements: null,
        },
        {
          level: 2,
          title: "Herb Handling",
          description: "Reduce the carried weight of each herb by 5 grams.",
          grants: { unlock: ["item.weight_delta:HERBS:-0.005"] },
          requirements: { requiresLevel: 1, itemCosts: [] },
        },
        {
          level: 3,
          title: "Herbal Medicine",
          description: "Unlock the medical use of herbs.",
          grants: { unlock: ["item.medicate:HERBS"] },
          requirements: { requiresLevel: 2, itemCosts: [] },
        },
      ];

      for (const level of levels) {
        await upsertResearchLevel(queryInterface, transaction, researchDefId, level);
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [defRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_research_def
        WHERE code = 'RESEARCH_HERBS'
        LIMIT 1
        `,
        { transaction }
      );

      const researchDefId = Number(defRows?.[0]?.id ?? 0) || null;
      if (researchDefId) {
        await queryInterface.bulkDelete("ga_user_research", { research_def_id: researchDefId }, { transaction });
        await queryInterface.bulkDelete("ga_research_level_def", { research_def_id: researchDefId }, { transaction });
        await queryInterface.bulkDelete("ga_research_def", { id: researchDefId }, { transaction });
      }

      const [itemRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_item_def
        WHERE code = 'HERBS'
        LIMIT 1
        `,
        { transaction }
      );

      const herbsItemDefId = Number(itemRows?.[0]?.id ?? 0) || null;
      if (herbsItemDefId) {
        await queryInterface.bulkDelete(
          "ga_item_def_component",
          {
            item_def_id: herbsItemDefId,
            component_type: "CONSUMABLE",
          },
          { transaction }
        );

        await queryInterface.bulkUpdate(
          "ga_item_def",
          {
            category: "MATERIAL",
          },
          { id: herbsItemDefId },
          { transaction }
        );
      }

      await queryInterface.sequelize.query(
        `
        ALTER TABLE ga_item_def
        MODIFY COLUMN category ENUM('CONSUMABLE', 'FOOD', 'EQUIP', 'AMMO', 'MATERIAL', 'QUEST', 'CONTAINER', 'MISC')
        NOT NULL DEFAULT 'MISC'
        `,
        { transaction }
      );
    });
  },
};
