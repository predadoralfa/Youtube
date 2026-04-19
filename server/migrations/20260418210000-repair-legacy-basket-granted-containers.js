"use strict";

function normalizeSlotCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
}

function makeGrantedRole(slotCode) {
  return `GRANTED:BASKET:${normalizeSlotCode(slotCode)}`;
}

async function fetchRows(queryInterface, transaction, sql, replacements = {}) {
  const [rows] = await queryInterface.sequelize.query(sql, {
    transaction,
    replacements,
  });
  return rows || [];
}

async function ensureBasketSlots(queryInterface, transaction, containerId, slotCount) {
  for (let i = 0; i < Math.max(0, Number(slotCount) || 0); i++) {
    await queryInterface.sequelize.query(
      `
      INSERT INTO ga_container_slot
        (container_id, slot_index, item_instance_id, qty)
      VALUES
        (:containerId, :slotIndex, NULL, 0)
      ON DUPLICATE KEY UPDATE
        container_id = VALUES(container_id)
      `,
      {
        transaction,
        replacements: {
          containerId,
          slotIndex: i,
        },
      }
    );
  }
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const basketItemDefs = await fetchRows(
        queryInterface,
        transaction,
        `
        SELECT id, code, name
        FROM ga_item_def
        WHERE code = 'BASKET'
        LIMIT 1
        `
      );
      const basketItemDef = basketItemDefs[0] ?? null;
      if (!basketItemDef?.id) {
        throw new Error("Nao foi possivel localizar o item BASKET para reparar os containers.");
      }

      const basketContainerDefs = await fetchRows(
        queryInterface,
        transaction,
        `
        SELECT id, code, name, slot_count, max_weight
        FROM ga_container_def
        WHERE code = 'BASKET'
        LIMIT 1
        `
      );
      const basketContainerDef = basketContainerDefs[0] ?? null;
      if (!basketContainerDef?.id) {
        throw new Error("Nao foi possivel localizar o container def BASKET.");
      }

      await queryInterface.sequelize.query(
        `
        UPDATE ga_container_def
        SET name = 'Basket',
            slot_count = 1,
            max_weight = 2.5,
            allowed_categories_mask = NULL,
            is_active = 1
        WHERE id = :containerDefId
        `,
        {
          transaction,
          replacements: {
            containerDefId: basketContainerDef.id,
          },
        }
      );

      const equippedRows = await fetchRows(
        queryInterface,
        transaction,
        `
        SELECT
          ei.owner_id AS owner_id,
          esd.code AS slot_code,
          ei.item_instance_id AS item_instance_id
        FROM ga_equipped_item ei
        INNER JOIN ga_equipment_slot_def esd
          ON esd.id = ei.slot_def_id
        INNER JOIN ga_item_instance ii
          ON ii.id = ei.item_instance_id
        WHERE ei.owner_kind = 'PLAYER'
          AND ii.item_def_id = :basketItemDefId
        ORDER BY ei.owner_id ASC, esd.code ASC
        `,
        {
          basketItemDefId: basketItemDef.id,
        }
      );

      for (const row of equippedRows) {
        const ownerId = String(row.owner_id);
        const slotCode = String(row.slot_code ?? "").trim();
        if (!ownerId || !slotCode) continue;

        const desiredRole = makeGrantedRole(slotCode);
        const legacyRole = normalizeSlotCode(slotCode);

        const candidateRows = await fetchRows(
          queryInterface,
          transaction,
          `
          SELECT
            co.container_id AS container_id,
            co.slot_role AS slot_role,
            c.container_def_id AS container_def_id
          FROM ga_container_owner co
          INNER JOIN ga_container c
            ON c.id = co.container_id
          INNER JOIN ga_container_def cd
            ON cd.id = c.container_def_id
          WHERE co.owner_kind = 'PLAYER'
            AND co.owner_id = :ownerId
            AND cd.code = 'BASKET'
            AND (
              co.slot_role = :desiredRole
              OR co.slot_role = :legacyRole
              OR co.slot_role = :slotCode
            )
          ORDER BY
            CASE
              WHEN co.slot_role = :desiredRole THEN 0
              WHEN co.slot_role = :legacyRole THEN 1
              WHEN co.slot_role = :slotCode THEN 2
              ELSE 3
            END,
            co.container_id ASC
          LIMIT 1
          `,
          {
            ownerId,
            desiredRole,
            legacyRole,
            slotCode,
          }
        );

        const candidate = candidateRows[0] ?? null;
        if (candidate?.container_id) {
          await queryInterface.sequelize.query(
            `
            UPDATE ga_container_owner
            SET slot_role = :desiredRole,
                updated_at = NOW()
            WHERE owner_kind = 'PLAYER'
              AND owner_id = :ownerId
              AND container_id = :containerId
            `,
            {
              transaction,
              replacements: {
                ownerId,
                containerId: candidate.container_id,
                desiredRole,
              },
            }
          );

          await queryInterface.sequelize.query(
            `
            UPDATE ga_container
            SET container_def_id = :containerDefId,
                slot_role = :desiredRole,
                state = 'ACTIVE',
                updated_at = NOW()
            WHERE id = :containerId
            `,
            {
              transaction,
              replacements: {
                containerId: candidate.container_id,
                containerDefId: basketContainerDef.id,
                desiredRole,
              },
            }
          );

          await ensureBasketSlots(
            queryInterface,
            transaction,
            candidate.container_id,
            basketContainerDef.slot_count
          );
          continue;
        }

        await queryInterface.sequelize.query(
          `
          INSERT INTO ga_container
            (container_def_id, slot_role, state, rev, created_at, updated_at)
          VALUES
            (:containerDefId, :desiredRole, 'ACTIVE', 1, NOW(), NOW())
          `,
          {
            transaction,
            replacements: {
              containerDefId: basketContainerDef.id,
              desiredRole,
            },
          }
        );

        const [containerIdRows] = await queryInterface.sequelize.query(
          `SELECT LAST_INSERT_ID() AS id`,
          { transaction }
        );
        const containerId = Number(containerIdRows?.[0]?.id ?? 0) || null;
        if (!containerId) {
          throw new Error(`Nao foi possivel criar o container da cesta para o owner ${ownerId}.`);
        }

        await queryInterface.sequelize.query(
          `
          INSERT INTO ga_container_owner
            (container_id, owner_kind, owner_id, slot_role, created_at, updated_at)
          VALUES
            (:containerId, 'PLAYER', :ownerId, :desiredRole, NOW(), NOW())
          `,
          {
            transaction,
            replacements: {
              containerId,
              ownerId,
              desiredRole,
            },
          }
        );

        await ensureBasketSlots(queryInterface, transaction, containerId, basketContainerDef.slot_count);
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        UPDATE ga_container_def
        SET name = 'Basket Pouch',
            slot_count = 1,
            max_weight = 2.5,
            allowed_categories_mask = NULL,
            is_active = 1
        WHERE code = 'BASKET'
        `,
        { transaction }
      );
    });
  },
};
