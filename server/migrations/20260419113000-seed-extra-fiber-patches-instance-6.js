"use strict";

const PATCH_POSITIONS = [
  { x: 37, y: 0, z: 22 },
  { x: 41, y: 0, z: 22 },
  { x: 43, y: 0, z: 22 },
  { x: 45, y: 0, z: 22 },
];

async function findSingleId(queryInterface, transaction, sql, replacements = {}) {
  const [rows] = await queryInterface.sequelize.query(sql, { transaction, replacements });
  return Number(rows?.[0]?.id ?? 0) || null;
}

async function findFiberActorDef(queryInterface, transaction) {
  return findSingleId(
    queryInterface,
    transaction,
    `
    SELECT id
    FROM ga_actor_def
    WHERE code = 'FIBER_PATCH'
    LIMIT 1
    `
  );
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

async function findFiberItemDef(queryInterface, transaction) {
  return findSingleId(
    queryInterface,
    transaction,
    `
    SELECT id
    FROM ga_item_def
    WHERE code = 'FIBER'
    LIMIT 1
    `
  );
}

async function findFiberRuleDef(queryInterface, transaction) {
  return findSingleId(
    queryInterface,
    transaction,
    `
    SELECT id
    FROM ga_actor_resource_rule_def
    WHERE code = 'FIBER_PATCH_REGEN'
    LIMIT 1
    `
  );
}

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

  return Number(rows?.[0]?.id ?? 0) || null;
}

async function ensurePatchAtPosition(queryInterface, Sequelize, transaction, context, pos) {
  const { actorDefId, containerDefId, containerSlotCount, itemDefId, ruleDefId, ownerUserId } = context;

  const actorId = await findSingleId(
    queryInterface,
    transaction,
    `
    SELECT id
    FROM ga_actor_runtime
    WHERE actor_def_id = :actorDefId
      AND instance_id = 6
      AND pos_x = :posX
      AND pos_y = :posY
      AND pos_z = :posZ
    LIMIT 1
    `,
    {
      actorDefId,
      posX: pos.x,
      posY: pos.y,
      posZ: pos.z,
    }
  );

  let runtimeActorId = actorId;
  if (!runtimeActorId) {
    await queryInterface.bulkInsert(
      "ga_actor_runtime",
      [
        {
          actor_def_id: Number(actorDefId),
          actor_spawn_id: null,
          instance_id: 6,
          pos_x: pos.x,
          pos_y: pos.y,
          pos_z: pos.z,
          state_json: JSON.stringify({
            resourceType: "FIBER_PATCH",
            visualHint: "GRASS",
          }),
          status: "ACTIVE",
          rev: 1,
          created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
          updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      ],
      { transaction }
    );

    runtimeActorId = await findSingleId(
      queryInterface,
      transaction,
      `
      SELECT id
      FROM ga_actor_runtime
      WHERE actor_def_id = :actorDefId
        AND instance_id = 6
        AND pos_x = :posX
        AND pos_y = :posY
        AND pos_z = :posZ
      ORDER BY id DESC
      LIMIT 1
      `,
      {
        actorDefId,
        posX: pos.x,
        posY: pos.y,
        posZ: pos.z,
      }
    );
  }

  if (!runtimeActorId) {
    throw new Error(`Nao foi possivel seedar o patch de fibra em (${pos.x}, ${pos.z}).`);
  }

  const spawnId = await findSingleId(
    queryInterface,
    transaction,
    `
    SELECT id
    FROM ga_actor_spawn
    WHERE instance_id = 6
      AND actor_def_id = :actorDefId
      AND pos_x = :posX
      AND pos_y = :posY
      AND pos_z = :posZ
    LIMIT 1
    `,
    {
      actorDefId,
      posX: pos.x,
      posY: pos.y,
      posZ: pos.z,
    }
  );

  let runtimeSpawnId = spawnId;
  if (!runtimeSpawnId) {
    await queryInterface.bulkInsert(
      "ga_actor_spawn",
      [
        {
          instance_id: 6,
          actor_def_id: Number(actorDefId),
          pos_x: pos.x,
          pos_y: pos.y,
          pos_z: pos.z,
          state_override_json: null,
          is_active: true,
          rev: 1,
          created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
          updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      ],
      { transaction }
    );

    runtimeSpawnId = await findSingleId(
      queryInterface,
      transaction,
      `
      SELECT id
      FROM ga_actor_spawn
      WHERE instance_id = 6
        AND actor_def_id = :actorDefId
        AND pos_x = :posX
        AND pos_y = :posY
        AND pos_z = :posZ
      ORDER BY id DESC
      LIMIT 1
      `,
      {
        actorDefId,
        posX: pos.x,
        posY: pos.y,
        posZ: pos.z,
      }
    );
  }

  await queryInterface.bulkUpdate(
    "ga_actor_runtime",
    {
      actor_spawn_id: runtimeSpawnId,
      state_json: JSON.stringify({
        resourceType: "FIBER_PATCH",
        visualHint: "GRASS",
      }),
      status: "ACTIVE",
      updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    { id: runtimeActorId },
    { transaction }
  );

  let containerId = await findSingleId(
    queryInterface,
    transaction,
    `
    SELECT c.id
    FROM ga_container c
    INNER JOIN ga_container_owner o ON o.container_id = c.id
    WHERE o.owner_kind = 'ACTOR'
      AND o.owner_id = :actorId
      AND o.slot_role = 'LOOT'
    LIMIT 1
    `,
    {
      actorId: runtimeActorId,
    }
  );

  if (!containerId) {
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

    const [createdContainerRows] = await queryInterface.sequelize.query(
      `
      SELECT id
      FROM ga_container
      WHERE container_def_id = :containerDefId
        AND slot_role = 'LOOT'
      ORDER BY id DESC
      LIMIT 1
      `,
      {
        transaction,
        replacements: {
          containerDefId: Number(containerDefId),
        },
      }
    );

    containerId = Number(createdContainerRows?.[0]?.id ?? 0) || null;
  }

  if (!containerId) {
    throw new Error(`Nao foi possivel seedar o container do patch de fibra em (${pos.x}, ${pos.z}).`);
  }

  await queryInterface.bulkInsert(
    "ga_container_owner",
    [
      {
        container_id: Number(containerId),
        owner_kind: "ACTOR",
        owner_id: Number(runtimeActorId),
        slot_role: "LOOT",
        created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
        updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    ],
    { transaction }
  ).catch(() => {});

  const [slotRows] = await queryInterface.sequelize.query(
    `
    SELECT COUNT(*) AS total
    FROM ga_container_slot
    WHERE container_id = :containerId
    `,
    {
      transaction,
      replacements: { containerId: Number(containerId) },
    }
  );

  if (Number(slotRows?.[0]?.total ?? 0) < Number(containerSlotCount ?? 0)) {
    const existingSlots = Number(slotRows?.[0]?.total ?? 0);
    const slots = Array.from(
      { length: Math.max(0, Number(containerSlotCount ?? 0) - existingSlots) },
      (_, index) => ({
        container_id: Number(containerId),
        slot_index: existingSlots + index,
        item_instance_id: null,
        qty: 0,
      })
    );

    if (slots.length > 0) {
      await queryInterface.bulkInsert("ga_container_slot", slots, { transaction }).catch(() => {});
    }
  }

  const [stateRows] = await queryInterface.sequelize.query(
    `
    SELECT actor_id
    FROM ga_actor_resource_state
    WHERE actor_id = :actorId
    LIMIT 1
    `,
    {
      transaction,
      replacements: { actorId: Number(runtimeActorId) },
    }
  );

  const now = new Date();
  const nextRefillAt = new Date(now.getTime() + 300000);

  if (stateRows?.[0]?.actor_id) {
    await queryInterface.bulkUpdate(
      "ga_actor_resource_state",
      {
        rule_def_id: Number(ruleDefId),
        current_qty: 10,
        last_refill_at: now,
        next_refill_at: nextRefillAt,
        state: "ACTIVE",
        updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      { actor_id: Number(stateRows[0].actor_id) },
      { transaction }
    );
    return;
  }

  await queryInterface.sequelize.query(
    `
    INSERT INTO ga_actor_resource_state
      (actor_id, rule_def_id, current_qty, last_refill_at, next_refill_at, state, rev, created_at, updated_at)
    VALUES
      (:actorId, :ruleId, 10, :lastRefillAt, :nextRefillAt, 'ACTIVE', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    {
      transaction,
      replacements: {
        actorId: Number(runtimeActorId),
        ruleId: Number(ruleDefId),
        lastRefillAt: now,
        nextRefillAt,
      },
    }
  );

  if (!itemDefId) {
    throw new Error("Nao foi possivel localizar o item FIBER.");
  }

  await queryInterface.bulkInsert(
    "ga_item_instance",
    [
      {
        item_def_id: Number(itemDefId),
        owner_user_id: Number(ownerUserId),
        bind_state: "NONE",
        durability: null,
        props_json: JSON.stringify({
          sourceActorId: Number(runtimeActorId),
          sourceType: "FIBER_PATCH",
        }),
        created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
        updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    ],
    { transaction }
  ).catch(() => {});

  const [fiberInstanceRows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_item_instance
    WHERE item_def_id = :itemDefId
      AND owner_user_id = :ownerUserId
    ORDER BY id DESC
    LIMIT 1
    `,
    {
      transaction,
      replacements: {
        itemDefId: Number(itemDefId),
        ownerUserId: Number(ownerUserId),
      },
    }
  );

  const fiberInstanceId = Number(fiberInstanceRows?.[0]?.id ?? 0) || null;
  if (fiberInstanceId) {
    await queryInterface.bulkUpdate(
      "ga_container_slot",
      {
        item_instance_id: fiberInstanceId,
        qty: 10,
      },
      {
        container_id: Number(containerId),
        slot_index: 0,
      },
      { transaction }
    );
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const actorDefId = await findFiberActorDef(queryInterface, transaction);
      const lootContainerDef = await findLootContainerDef(queryInterface, transaction);
      const itemDefId = await findFiberItemDef(queryInterface, transaction);
      const ruleDefId = await findFiberRuleDef(queryInterface, transaction);
      const ownerUserId = await findFirstUserId(queryInterface, transaction);

      if (!actorDefId || !lootContainerDef?.id || !ruleDefId || !ownerUserId) {
        throw new Error("Nao foi possivel localizar as definicoes base do patch de fibra.");
      }

      for (const pos of PATCH_POSITIONS) {
        await ensurePatchAtPosition(queryInterface, Sequelize, transaction, {
          actorDefId,
          containerDefId: lootContainerDef.id,
          containerSlotCount: lootContainerDef.slot_count,
          itemDefId,
          ruleDefId,
          ownerUserId,
        }, pos);
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const pos of PATCH_POSITIONS) {
        const [actorRows] = await queryInterface.sequelize.query(
          `
          SELECT id
          FROM ga_actor_runtime
          WHERE instance_id = 6
            AND pos_x = :posX
            AND pos_y = :posY
            AND pos_z = :posZ
            AND actor_def_id = (
              SELECT id FROM ga_actor_def WHERE code = 'FIBER_PATCH' LIMIT 1
            )
          LIMIT 1
          `,
          {
            transaction,
            replacements: {
              posX: pos.x,
              posY: pos.y,
              posZ: pos.z,
            },
          }
        );

        const actorId = Number(actorRows?.[0]?.id ?? 0) || null;
        if (!actorId) continue;

        const [containerRows] = await queryInterface.sequelize.query(
          `
          SELECT c.id
          FROM ga_container c
          INNER JOIN ga_container_owner o ON o.container_id = c.id
          WHERE o.owner_kind = 'ACTOR'
            AND o.owner_id = :actorId
            AND o.slot_role = 'LOOT'
          LIMIT 1
          `,
          {
            transaction,
            replacements: { actorId },
          }
        );

        const containerId = Number(containerRows?.[0]?.id ?? 0) || null;
        if (containerId) {
          await queryInterface.bulkDelete("ga_container_slot", { container_id: containerId }, { transaction });
          await queryInterface.bulkDelete("ga_container_owner", { container_id: containerId }, { transaction });
          await queryInterface.bulkDelete("ga_container", { id: containerId }, { transaction });
        }

        await queryInterface.bulkDelete("ga_actor_resource_state", { actor_id: actorId }, { transaction });
        await queryInterface.bulkDelete("ga_actor_spawn", {
          instance_id: 6,
          pos_x: pos.x,
          pos_y: pos.y,
          pos_z: pos.z,
        }, { transaction }).catch(() => {});
        await queryInterface.bulkDelete("ga_actor_runtime", { id: actorId }, { transaction });
      }
    });
  },
};
