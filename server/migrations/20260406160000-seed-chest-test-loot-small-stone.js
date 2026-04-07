"use strict";

const TARGET = {
  instanceId: 6,
  actorCode: "CHEST_TEST",
  itemCode: "SMALL_STONE",
  qty: 12,
  seedTag: "CHEST_TEST_LOOT_SEED_V1",
};

async function findFirstUserId(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_user
    ORDER BY id ASC
    LIMIT 1
    `,
    { transaction }
  );
  return rows?.[0]?.id ? Number(rows[0].id) : null;
}

async function findItemDef(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_item_def
    WHERE code = :itemCode
    LIMIT 1
    `,
    {
      transaction,
      replacements: { itemCode: TARGET.itemCode },
    }
  );
  return rows?.[0]?.id ? Number(rows[0].id) : null;
}

async function findChestActorsWithLootContainer(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT
      a.id AS actor_id,
      co.container_id
    FROM ga_actor a
    JOIN ga_actor_def ad ON ad.id = a.actor_def_id
    JOIN ga_container_owner co
      ON co.owner_kind = 'ACTOR'
     AND co.owner_id = a.id
     AND co.slot_role = 'LOOT'
    WHERE ad.code = :actorCode
      AND a.instance_id = :instanceId
      AND a.status = 'ACTIVE'
    ORDER BY a.id ASC
    `,
    {
      transaction,
      replacements: {
        actorCode: TARGET.actorCode,
        instanceId: TARGET.instanceId,
      },
    }
  );

  return (rows ?? []).map((row) => ({
    actorId: Number(row.actor_id),
    containerId: Number(row.container_id),
  }));
}

async function getContainerSlots(queryInterface, transaction, containerId) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT slot_index, item_instance_id, qty
    FROM ga_container_slot
    WHERE container_id = :containerId
    ORDER BY slot_index ASC
    `,
    {
      transaction,
      replacements: { containerId: Number(containerId) },
    }
  );
  return rows ?? [];
}

async function createItemInstance(queryInterface, transaction, { itemDefId, ownerUserId, actorId }) {
  await queryInterface.bulkInsert(
    "ga_item_instance",
    [
      {
        item_def_id: Number(itemDefId),
        owner_user_id: Number(ownerUserId),
        bind_state: "NONE",
        durability: null,
        props_json: JSON.stringify({
          sourceActorId: Number(actorId),
          sourceType: "CHEST_TEST",
          seedTag: TARGET.seedTag,
        }),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ],
    { transaction }
  );

  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_item_instance
    WHERE item_def_id = :itemDefId
      AND owner_user_id = :ownerUserId
      AND JSON_UNQUOTE(JSON_EXTRACT(props_json, '$.seedTag')) = :seedTag
    ORDER BY id DESC
    LIMIT 1
    `,
    {
      transaction,
      replacements: {
        itemDefId: Number(itemDefId),
        ownerUserId: Number(ownerUserId),
        seedTag: TARGET.seedTag,
      },
    }
  );

  const itemInstanceId = rows?.[0]?.id ? Number(rows[0].id) : null;
  if (!itemInstanceId) {
    throw new Error("Falha ao criar item instance para seed do chest.");
  }
  return itemInstanceId;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const itemDefId = await findItemDef(queryInterface, transaction);
      if (!itemDefId) {
        throw new Error(`Nao encontrei ga_item_def ${TARGET.itemCode}.`);
      }

      const ownerUserId = await findFirstUserId(queryInterface, transaction);
      if (!ownerUserId) {
        throw new Error("Nao encontrei usuario para ownership do item seedado.");
      }

      const targets = await findChestActorsWithLootContainer(queryInterface, transaction);
      if (targets.length === 0) return;

      for (const target of targets) {
        const slots = await getContainerSlots(queryInterface, transaction, target.containerId);
        const hasLoot = slots.some(
          (slot) => slot.item_instance_id != null && Number(slot.qty ?? 0) > 0
        );

        if (hasLoot) continue;

        const emptySlot = slots.find((slot) => slot.item_instance_id == null) ?? null;
        if (!emptySlot) continue;

        const itemInstanceId = await createItemInstance(queryInterface, transaction, {
          itemDefId,
          ownerUserId,
          actorId: target.actorId,
        });

        await queryInterface.bulkUpdate(
          "ga_container_slot",
          {
            item_instance_id: Number(itemInstanceId),
            qty: Number(TARGET.qty),
          },
          {
            container_id: Number(target.containerId),
            slot_index: Number(emptySlot.slot_index),
          },
          { transaction }
        );

        await queryInterface.sequelize.query(
          `
          UPDATE ga_container
          SET rev = rev + 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = :containerId
          `,
          {
            transaction,
            replacements: { containerId: Number(target.containerId) },
          }
        );
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [seedItems] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_item_instance
        WHERE JSON_UNQUOTE(JSON_EXTRACT(props_json, '$.seedTag')) = :seedTag
        `,
        {
          transaction,
          replacements: { seedTag: TARGET.seedTag },
        }
      );

      const seedItemIds = (seedItems ?? [])
        .map((row) => Number(row.id))
        .filter((id) => Number.isInteger(id) && id > 0);

      if (seedItemIds.length === 0) return;

      await queryInterface.bulkUpdate(
        "ga_container_slot",
        {
          item_instance_id: null,
          qty: 0,
        },
        {
          item_instance_id: { [Sequelize.Op.in]: seedItemIds },
        },
        { transaction }
      );

      await queryInterface.bulkDelete(
        "ga_item_instance",
        { id: { [Sequelize.Op.in]: seedItemIds } },
        { transaction }
      );
    });
  },
};

