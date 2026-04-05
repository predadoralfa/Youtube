"use strict";

const TREE_POSITIONS = [
  { x: 27, z: 18 },
  { x: 31, z: 18 },
  { x: 35, z: 18 },
];

async function findAppleItemDefId(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_item_def
    WHERE code = 'FOOD-APPLE'
    LIMIT 1
    `,
    { transaction }
  );

  return rows?.[0]?.id ?? null;
}

async function findLootContainerDef(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id, slot_count
    FROM ga_container_def
    WHERE code IN ('Stone Container', 'LOOT_CONTAINER', 'CHEST_10')
    ORDER BY FIELD(code, 'Stone Container', 'LOOT_CONTAINER', 'CHEST_10')
    LIMIT 1
    `,
    { transaction }
  );

  return rows?.[0] ?? null;
}

async function findOwnerUserId(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_user
    ORDER BY id ASC
    LIMIT 1
    `,
    { transaction }
  );

  return rows?.[0]?.id ?? null;
}

async function findTreeActorAtPosition(queryInterface, transaction, pos) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_actor
    WHERE actor_type = 'TREE'
      AND instance_id = 6
      AND pos_x = ${Number(pos.x)}
      AND pos_y = ${Number(pos.z)}
    LIMIT 1
    `,
    { transaction }
  );

  return rows?.[0]?.id ?? null;
}

async function ensureTreeSeed(queryInterface, Sequelize, transaction, {
  appleItemDefId,
  containerDefId,
  containerSlotCount,
  ownerUserId,
  pos,
}) {
  const existingActorId = await findTreeActorAtPosition(queryInterface, transaction, pos);
  if (existingActorId) return;

  await queryInterface.bulkInsert(
    "ga_actor",
    [
      {
        actor_type: "TREE",
        instance_id: 6,
        pos_x: Number(pos.x),
        pos_y: Number(pos.z),
        state_json: JSON.stringify({
          resourceType: "APPLE_TREE",
          visualHint: "TREE",
        }),
        status: "ACTIVE",
        created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
        updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    ],
    { transaction }
  );

  const actorId = await findTreeActorAtPosition(queryInterface, transaction, pos);
  if (!actorId) {
    throw new Error(`Nao foi possivel localizar a macieira seedada em (${pos.x}, ${pos.z}).`);
  }

  await queryInterface.bulkInsert(
    "ga_container",
    [
      {
        container_def_id: Number(containerDefId),
        slot_role: "LOOT",
        state: "ACTIVE",
        rev: 1,
        created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
        updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    ],
    { transaction }
  );

  const [containerRows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_container
    WHERE container_def_id = ${Number(containerDefId)}
      AND slot_role = 'LOOT'
    ORDER BY id DESC
    LIMIT 1
    `,
    { transaction }
  );

  const containerId = containerRows?.[0]?.id ?? null;
  if (!containerId) {
    throw new Error(`Nao foi possivel localizar o container da macieira em (${pos.x}, ${pos.z}).`);
  }

  await queryInterface.bulkInsert(
    "ga_container_owner",
    [
      {
        container_id: Number(containerId),
        owner_kind: "ACTOR",
        owner_id: Number(actorId),
        slot_role: "LOOT",
      },
    ],
    { transaction }
  );

  const emptySlots = Array.from({ length: Number(containerSlotCount) }, (_, index) => ({
    container_id: Number(containerId),
    slot_index: index,
    item_instance_id: null,
    qty: 0,
  }));

  await queryInterface.bulkInsert("ga_container_slot", emptySlots, { transaction });

  await queryInterface.bulkInsert(
    "ga_item_instance",
    [
      {
        item_def_id: Number(appleItemDefId),
        owner_user_id: Number(ownerUserId),
        bind_state: "NONE",
        durability: null,
        props_json: JSON.stringify({
          sourceActorId: Number(actorId),
          sourceType: "APPLE_TREE",
        }),
        created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
        updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    ],
    { transaction }
  );

  const [itemRows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_item_instance
    WHERE item_def_id = ${Number(appleItemDefId)}
      AND owner_user_id = ${Number(ownerUserId)}
    ORDER BY id DESC
    LIMIT 1
    `,
    { transaction }
  );

  const itemInstanceId = itemRows?.[0]?.id ?? null;
  if (!itemInstanceId) {
    throw new Error(`Nao foi possivel localizar a instancia de maca da arvore em (${pos.x}, ${pos.z}).`);
  }

  await queryInterface.bulkUpdate(
    "ga_container_slot",
    {
      item_instance_id: Number(itemInstanceId),
      qty: 5,
    },
    {
      container_id: Number(containerId),
      slot_index: 0,
    },
    { transaction }
  );
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const appleItemDefId = await findAppleItemDefId(queryInterface, transaction);
      if (!appleItemDefId) {
        throw new Error("Nao foi possivel localizar ga_item_def FOOD-APPLE.");
      }

      const containerDef = await findLootContainerDef(queryInterface, transaction);
      const containerDefId = containerDef?.id ?? null;
      const containerSlotCount = Number(containerDef?.slot_count ?? 0);
      if (!containerDefId || !Number.isInteger(containerSlotCount) || containerSlotCount < 1) {
        throw new Error("Nao encontrei container def reutilizavel para as macieiras.");
      }

      const ownerUserId = await findOwnerUserId(queryInterface, transaction);
      if (!ownerUserId) {
        throw new Error("Nao foi possivel localizar um usuario para seedar as macieiras.");
      }

      for (const pos of TREE_POSITIONS) {
        await ensureTreeSeed(queryInterface, Sequelize, transaction, {
          appleItemDefId,
          containerDefId,
          containerSlotCount,
          ownerUserId,
          pos,
        });
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [actorRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_actor
        WHERE actor_type = 'TREE'
          AND instance_id = 6
          AND (
            (pos_x = 27 AND pos_y = 18) OR
            (pos_x = 31 AND pos_y = 18) OR
            (pos_x = 35 AND pos_y = 18)
          )
        `,
        { transaction }
      );

      const actorIds = actorRows.map((row) => Number(row.id)).filter(Number.isInteger);
      if (actorIds.length === 0) return;

      const [ownerRows] = await queryInterface.sequelize.query(
        `
        SELECT container_id
        FROM ga_container_owner
        WHERE owner_kind = 'ACTOR'
          AND owner_id IN (${actorIds.join(",")})
          AND slot_role = 'LOOT'
        `,
        { transaction }
      );

      const containerIds = ownerRows.map((row) => Number(row.container_id)).filter(Number.isInteger);

      if (containerIds.length > 0) {
        const [slotRows] = await queryInterface.sequelize.query(
          `
          SELECT item_instance_id
          FROM ga_container_slot
          WHERE container_id IN (${containerIds.join(",")})
            AND item_instance_id IS NOT NULL
          `,
          { transaction }
        );

        const itemInstanceIds = slotRows
          .map((row) => Number(row.item_instance_id))
          .filter(Number.isInteger);

        await queryInterface.bulkDelete(
          "ga_container_slot",
          { container_id: { [Sequelize.Op.in]: containerIds } },
          { transaction }
        );

        await queryInterface.bulkDelete(
          "ga_container_owner",
          { container_id: { [Sequelize.Op.in]: containerIds } },
          { transaction }
        );

        await queryInterface.bulkDelete(
          "ga_container",
          { id: { [Sequelize.Op.in]: containerIds } },
          { transaction }
        );

        if (itemInstanceIds.length > 0) {
          await queryInterface.bulkDelete(
            "ga_item_instance",
            { id: { [Sequelize.Op.in]: itemInstanceIds } },
            { transaction }
          );
        }
      }

      await queryInterface.bulkDelete(
        "ga_actor",
        { id: { [Sequelize.Op.in]: actorIds } },
        { transaction }
      );
    });
  },
};
