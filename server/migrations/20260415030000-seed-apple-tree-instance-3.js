"use strict";

const TREE_POSITION = { x: 30, y: 0, z: 13 };
const TREE_INSTANCE_ID = 3;

async function findActorDefId(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_actor_def
    WHERE code = 'TREE_APPLE'
    LIMIT 1
    `,
    { transaction }
  );

  return rows?.[0]?.id ?? null;
}

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
    WHERE code IN ('LOOT_CONTAINER', 'Stone Container', 'CHEST_10')
    ORDER BY FIELD(code, 'LOOT_CONTAINER', 'Stone Container', 'CHEST_10')
    LIMIT 1
    `,
    { transaction }
  );

  return rows?.[0] ?? null;
}

async function findAnyUserId(queryInterface, transaction) {
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

async function findRuntimeActorAtPosition(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_actor_runtime
    WHERE instance_id = ${TREE_INSTANCE_ID}
      AND pos_x = ${Number(TREE_POSITION.x)}
      AND pos_y = ${Number(TREE_POSITION.y)}
      AND pos_z = ${Number(TREE_POSITION.z)}
    LIMIT 1
    `,
    { transaction }
  );

  return rows?.[0]?.id ?? null;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const existingActorId = await findRuntimeActorAtPosition(queryInterface, transaction);
      if (existingActorId) return;

      const actorDefId = await findActorDefId(queryInterface, transaction);
      if (!actorDefId) {
        throw new Error("Nao foi possivel localizar ga_actor_def TREE_APPLE.");
      }

      const appleItemDefId = await findAppleItemDefId(queryInterface, transaction);
      if (!appleItemDefId) {
        throw new Error("Nao foi possivel localizar ga_item_def FOOD-APPLE.");
      }

      const lootContainerDef = await findLootContainerDef(queryInterface, transaction);
      const containerDefId = lootContainerDef?.id ?? null;
      const containerSlotCount = Number(lootContainerDef?.slot_count ?? 0);
      if (!containerDefId || !Number.isInteger(containerSlotCount) || containerSlotCount < 1) {
        throw new Error("Nao encontrei container def reutilizavel para a arvore.");
      }

      await queryInterface.bulkInsert(
        "ga_actor_runtime",
        [
          {
            actor_def_id: Number(actorDefId),
            actor_spawn_id: null,
            instance_id: TREE_INSTANCE_ID,
            pos_x: Number(TREE_POSITION.x),
            pos_y: Number(TREE_POSITION.y),
            pos_z: Number(TREE_POSITION.z),
            state_json: JSON.stringify({
              resourceType: "APPLE_TREE",
              visualHint: "TREE",
            }),
            status: "ACTIVE",
            rev: 1,
            created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
            updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
        ],
        { transaction }
      );

      const treeActorId = await findRuntimeActorAtPosition(queryInterface, transaction);
      if (!treeActorId) {
        throw new Error("Nao foi possivel localizar a arvore seedada.");
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

      const treeContainerId = containerRows?.[0]?.id ?? null;
      if (!treeContainerId) {
        throw new Error("Nao foi possivel localizar o container da arvore.");
      }

      await queryInterface.bulkInsert(
        "ga_container_owner",
        [
          {
            container_id: Number(treeContainerId),
            owner_kind: "ACTOR",
            owner_id: Number(treeActorId),
            slot_role: "LOOT",
          },
        ],
        { transaction }
      );

      const emptySlots = Array.from({ length: containerSlotCount }, (_, index) => ({
        container_id: Number(treeContainerId),
        slot_index: index,
        item_instance_id: null,
        qty: 0,
      }));
      await queryInterface.bulkInsert("ga_container_slot", emptySlots, { transaction });

      const ownerUserId = await findAnyUserId(queryInterface, transaction);
      if (!ownerUserId) return;

      await queryInterface.bulkInsert(
        "ga_item_instance",
        [
          {
            item_def_id: Number(appleItemDefId),
            owner_user_id: Number(ownerUserId),
            bind_state: "NONE",
            durability: null,
            props_json: JSON.stringify({
              sourceActorId: Number(treeActorId),
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

      const appleItemInstanceId = itemRows?.[0]?.id ?? null;
      if (!appleItemInstanceId) {
        throw new Error("Nao foi possivel localizar a instancia da maca.");
      }

      await queryInterface.bulkUpdate(
        "ga_container_slot",
        {
          item_instance_id: Number(appleItemInstanceId),
          qty: 5,
        },
        {
          container_id: Number(treeContainerId),
          slot_index: 0,
        },
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [actorRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_actor_runtime
        WHERE instance_id = ${TREE_INSTANCE_ID}
          AND pos_x = ${Number(TREE_POSITION.x)}
          AND pos_y = ${Number(TREE_POSITION.y)}
          AND pos_z = ${Number(TREE_POSITION.z)}
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
        "ga_actor_runtime",
        { id: { [Sequelize.Op.in]: actorIds } },
        { transaction }
      );
    });
  },
};
