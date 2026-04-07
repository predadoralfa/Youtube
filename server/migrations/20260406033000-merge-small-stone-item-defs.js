"use strict";

const CANONICAL_CODE = "SMALL_STONE";
const ALIAS_CODES = ["SMALL_STONE", "MATERIAL-STONE"];

function buildStonePayload(eraMinId) {
  return {
    code: CANONICAL_CODE,
    name: "Small Stone",
    category: "MATERIAL",
    stack_max: 50,
    unit_weight: 0.4,
    era_min_id: eraMinId,
    is_active: true,
  };
}

async function findStoneRows(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id, code, name, category, stack_max, unit_weight, era_min_id, is_active
    FROM ga_item_def
    WHERE code IN (:codes)
    ORDER BY CASE WHEN code = :canonicalCode THEN 0 ELSE 1 END, id ASC
    `,
    {
      transaction,
      replacements: {
        codes: ALIAS_CODES,
        canonicalCode: CANONICAL_CODE,
      },
    }
  );

  return rows ?? [];
}

async function findEraOneId(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_era_def
    WHERE order_index = 1
    LIMIT 1
    `,
    { transaction }
  );

  return Number(rows?.[0]?.id ?? 0) || null;
}

async function moveForeignKeys(queryInterface, transaction, sourceIds, targetId) {
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) return;

  await queryInterface.sequelize.query(
    `
    UPDATE ga_item_instance
    SET item_def_id = :targetId
    WHERE item_def_id IN (:sourceIds)
    `,
    {
      transaction,
      replacements: { targetId, sourceIds },
    }
  );

  await queryInterface.sequelize.query(
    `
    UPDATE ga_research_def
    SET item_def_id = :targetId
    WHERE item_def_id IN (:sourceIds)
    `,
    {
      transaction,
      replacements: { targetId, sourceIds },
    }
  );

  await queryInterface.sequelize.query(
    `
    UPDATE ga_item_def_component
    SET item_def_id = :targetId
    WHERE item_def_id IN (:sourceIds)
    `,
    {
      transaction,
      replacements: { targetId, sourceIds },
    }
  );

  await queryInterface.sequelize.query(
    `
    DELETE c1
    FROM ga_item_def_component c1
    INNER JOIN ga_item_def_component c2
      ON c1.item_def_id = c2.item_def_id
     AND c1.component_type = c2.component_type
     AND c1.id > c2.id
    WHERE c1.item_def_id = :targetId
    `,
    {
      transaction,
      replacements: { targetId },
    }
  );
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const eraMinId = await findEraOneId(queryInterface, transaction);
      if (!eraMinId) {
        throw new Error("Nao foi possivel localizar a Era 1 para consolidar SMALL_STONE.");
      }

      const rows = await findStoneRows(queryInterface, transaction);
      const canonicalRow =
        rows.find((row) => String(row.code) === CANONICAL_CODE) ?? rows[0] ?? null;

      if (!canonicalRow) {
        await queryInterface.bulkInsert(
          "ga_item_def",
          [buildStonePayload(eraMinId)],
          { transaction }
        );
      } else if (String(canonicalRow.code) !== CANONICAL_CODE) {
        await queryInterface.bulkUpdate(
          "ga_item_def",
          buildStonePayload(eraMinId),
          { id: canonicalRow.id },
          { transaction }
        );
      } else {
        await queryInterface.bulkUpdate(
          "ga_item_def",
          buildStonePayload(eraMinId),
          { id: canonicalRow.id },
          { transaction }
        );
      }

      const [canonicalRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_item_def
        WHERE code = :canonicalCode
        LIMIT 1
        `,
        {
          transaction,
          replacements: { canonicalCode: CANONICAL_CODE },
        }
      );

      const canonicalId = Number(canonicalRows?.[0]?.id ?? 0) || null;
      if (!canonicalId) {
        throw new Error("Nao foi possivel localizar SMALL_STONE apos consolidacao.");
      }

      const sourceIds = rows
        .map((row) => Number(row.id))
        .filter((id) => Number.isFinite(id) && id > 0 && id !== canonicalId);

      await moveForeignKeys(queryInterface, transaction, sourceIds, canonicalId);

      if (sourceIds.length > 0) {
        await queryInterface.sequelize.query(
          `
          DELETE FROM ga_item_def
          WHERE id IN (:sourceIds)
          `,
          {
            transaction,
            replacements: { sourceIds },
          }
        );
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [canonicalRows] = await queryInterface.sequelize.query(
        `
        SELECT id, code, name, category, stack_max, unit_weight, era_min_id, is_active
        FROM ga_item_def
        WHERE code = :canonicalCode
        LIMIT 1
        `,
        {
          transaction,
          replacements: { canonicalCode: CANONICAL_CODE },
        }
      );

      const canonicalRow = canonicalRows?.[0] ?? null;
      if (!canonicalRow) return;

      const [aliasRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_item_def
        WHERE code = 'MATERIAL-STONE'
        LIMIT 1
        `,
        { transaction }
      );

      const aliasRow = aliasRows?.[0] ?? null;
      if (aliasRow?.id) return;

      const payload = {
        code: "MATERIAL-STONE",
        name: "Stone",
        category: canonicalRow.category ?? "MATERIAL",
        stack_max: canonicalRow.stack_max ?? 50,
        unit_weight: canonicalRow.unit_weight ?? 0.4,
        era_min_id: canonicalRow.era_min_id ?? null,
        is_active: canonicalRow.is_active ?? true,
      };

      await queryInterface.bulkInsert("ga_item_def", [payload], { transaction });
    });
  },
};
