"use strict";

function buildStonePayload(eraMinId) {
  return {
    code: "SMALL_STONE",
    name: "Small Stone",
    category: "MATERIAL",
    stack_max: 50,
    unit_weight: 0.4,
    era_min_id: eraMinId,
    is_active: true,
  };
}

async function findItemDef(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id, code
    FROM ga_item_def
    WHERE code IN ('SMALL_STONE', 'MATERIAL-STONE')
    ORDER BY CASE WHEN code = 'SMALL_STONE' THEN 0 ELSE 1 END, id ASC
    LIMIT 1
    `,
    { transaction }
  );

  return rows?.[0] ?? null;
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
        throw new Error("Nao foi possivel localizar a Era 1 para normalizar SMALL_STONE.");
      }

      const stoneRow = await findItemDef(queryInterface, transaction);
      const payload = buildStonePayload(eraMinId);

      if (!stoneRow) {
        await queryInterface.bulkInsert(
          "ga_item_def",
          [payload],
          { transaction }
        );
      } else if (String(stoneRow.code) === "SMALL_STONE") {
        await queryInterface.bulkUpdate(
          "ga_item_def",
          payload,
          { id: stoneRow.id },
          { transaction }
        );
      } else {
        await queryInterface.bulkUpdate(
          "ga_item_def",
          payload,
          { id: stoneRow.id },
          { transaction }
        );
      }

      await queryInterface.sequelize.query(
        `
        UPDATE ga_research_level_def
        SET requirements_json = CASE
          WHEN requirements_json IS NULL THEN NULL
          ELSE REPLACE(requirements_json, 'MATERIAL-STONE', 'SMALL_STONE')
        END
        WHERE requirements_json LIKE '%MATERIAL-STONE%'
        `,
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [stoneRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_item_def
        WHERE code = 'SMALL_STONE'
        LIMIT 1
        `,
        { transaction }
      );

      const stoneRow = stoneRows?.[0] ?? null;
      if (stoneRow?.id) {
        await queryInterface.bulkUpdate(
          "ga_item_def",
          {
            code: "MATERIAL-STONE",
            name: "Stone",
            category: "MATERIAL",
            stack_max: 50,
            unit_weight: 0.4,
            is_active: true,
          },
          { id: stoneRow.id },
          { transaction }
        );
      }

      await queryInterface.sequelize.query(
        `
        UPDATE ga_research_level_def
        SET requirements_json = CASE
          WHEN requirements_json IS NULL THEN NULL
          ELSE REPLACE(requirements_json, 'SMALL_STONE', 'MATERIAL-STONE')
        END
        WHERE requirements_json LIKE '%SMALL_STONE%'
        `,
        { transaction }
      );
    });
  },
};
