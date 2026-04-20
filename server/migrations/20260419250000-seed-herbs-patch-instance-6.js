"use strict";

const HERBS_PATCH_POSITIONS = [
  { x: 35, y: 0, z: 22 },
  { x: 47, y: 0, z: 22 },
];

async function findSingleId(queryInterface, transaction, sql, replacements = {}) {
  const [rows] = await queryInterface.sequelize.query(sql, { transaction, replacements });
  return Number(rows?.[0]?.id ?? 0) || null;
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

async function upsertActorDef(queryInterface, Sequelize, transaction, payload) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_actor_def
    WHERE code = :code
    LIMIT 1
    `,
    {
      transaction,
      replacements: { code: payload.code },
    }
  );

  const existingId = Number(rows?.[0]?.id ?? 0) || null;
  const insertPayload = { ...payload };
  const updatePayload = { ...payload };
  delete updatePayload.created_at;
  delete updatePayload.updated_at;

  if (!existingId) {
    await queryInterface.bulkInsert("ga_actor_def", [insertPayload], { transaction });
    return findSingleId(
      queryInterface,
      transaction,
      `
      SELECT id
      FROM ga_actor_def
      WHERE code = :code
      LIMIT 1
      `,
      { code: payload.code }
    );
  }

  await queryInterface.bulkUpdate("ga_actor_def", updatePayload, { id: existingId }, { transaction });
  return existingId;
}

async function ensureResourceNode(queryInterface, Sequelize, transaction, context, pos) {
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
            resourceType: "HERBS_PATCH",
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
    throw new Error(`Nao foi possivel seedar o patch de Herbs em (${pos.x}, ${pos.z}).`);
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

  if (!runtimeSpawnId) {
    throw new Error(`Nao foi possivel seedar o spawn do patch de Herbs em (${pos.x}, ${pos.z}).`);
  }

  await queryInterface.bulkUpdate(
    "ga_actor_runtime",
    {
      actor_spawn_id: runtimeSpawnId,
      state_json: JSON.stringify({
        resourceType: "HERBS_PATCH",
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

    containerId = await findSingleId(
      queryInterface,
      transaction,
      `
      SELECT id
      FROM ga_container
      WHERE container_def_id = :containerDefId
        AND slot_role = 'LOOT'
      ORDER BY id DESC
      LIMIT 1
      `,
      {
        containerDefId,
      }
    );
  }

  if (!containerId) {
    throw new Error("Nao foi possivel seedar o container do patch de Herbs.");
  }

  const existingOwnerId = await findSingleId(
    queryInterface,
    transaction,
    `
    SELECT container_id AS id
    FROM ga_container_owner
    WHERE owner_kind = 'ACTOR'
      AND owner_id = :actorId
      AND container_id = :containerId
      AND slot_role = 'LOOT'
    LIMIT 1
    `,
    {
      actorId: runtimeActorId,
      containerId,
    }
  );

  if (!existingOwnerId) {
    await queryInterface.bulkInsert(
      "ga_container_owner",
      [
        {
          container_id: containerId,
          owner_kind: "ACTOR",
          owner_id: runtimeActorId,
          slot_role: "LOOT",
        },
      ],
      { transaction }
    );
  }

  const slotRows = Array.from({ length: Math.max(1, Number(containerSlotCount ?? 1)) }, (_, index) => ({
    container_id: containerId,
    slot_index: index,
    item_instance_id: null,
    qty: 0,
  }));

  const [existingSlots] = await queryInterface.sequelize.query(
    `
    SELECT COUNT(*) AS count
    FROM ga_container_slot
    WHERE container_id = :containerId
    `,
    {
      transaction,
      replacements: { containerId },
    }
  );

  if (Number(existingSlots?.[0]?.count ?? 0) <= 0) {
    await queryInterface.bulkInsert("ga_container_slot", slotRows, { transaction });
  }

  const [resourceStateRows] = await queryInterface.sequelize.query(
    `
    SELECT actor_id AS id
    FROM ga_actor_resource_state
    WHERE actor_id = :actorId
    LIMIT 1
    `,
    {
      transaction,
      replacements: { actorId: runtimeActorId },
    }
  );

  if (!resourceStateRows?.[0]?.id) {
    const now = new Date();
    const nextRefillAt = new Date(now.getTime() + 300000);

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
  }

  const [slot0Rows] = await queryInterface.sequelize.query(
    `
    SELECT slot_index, item_instance_id, qty
    FROM ga_container_slot
    WHERE container_id = :containerId
      AND slot_index = 0
    LIMIT 1
    `,
    {
      transaction,
      replacements: { containerId },
    }
  );

  const slot0 = slot0Rows?.[0] ?? null;
  if (!slot0?.item_instance_id) {
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
            sourceType: "HERBS_PATCH",
          }),
          created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
          updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      ],
      { transaction }
    );

    const [itemInstanceRows] = await queryInterface.sequelize.query(
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

    const itemInstanceId = Number(itemInstanceRows?.[0]?.id ?? 0) || null;
    if (itemInstanceId) {
      await queryInterface.bulkUpdate(
        "ga_container_slot",
        {
          item_instance_id: itemInstanceId,
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
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [lootContainerDef] = await queryInterface.sequelize.query(
        `
        SELECT id, slot_count
        FROM ga_container_def
        WHERE code IN ('LOOT_CONTAINER', 'Stone Container', 'CHEST_10')
        ORDER BY FIELD(code, 'LOOT_CONTAINER', 'Stone Container', 'CHEST_10')
        LIMIT 1
        `,
        { transaction }
      );

      const containerDefId = Number(lootContainerDef?.[0]?.id ?? 0) || null;
      const containerSlotCount = Number(lootContainerDef?.[0]?.slot_count ?? 0) || 0;
      if (!containerDefId || containerSlotCount < 1) {
        throw new Error("Nao encontrei container de loot para Herbs.");
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
      if (!herbsItemDefId) {
        throw new Error("Nao foi possivel localizar ga_item_def HERBS.");
      }

      const actorDefPayload = {
        code: "HERBS_PATCH",
        name: "Herbs Patch",
        actor_kind: "RESOURCE_NODE",
        visual_hint: "GRASS",
        asset_key: "Grass.glb",
        default_state_json: JSON.stringify({
          resourceType: "HERBS_PATCH",
          visualHint: "GRASS",
        }),
        default_container_def_id: containerDefId,
        is_active: true,
        created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
        updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
      };

      const herbsActorDefId = await upsertActorDef(
        queryInterface,
        Sequelize,
        transaction,
        actorDefPayload
      );

      if (!herbsActorDefId) {
        throw new Error("Nao foi possivel seedar o actor HERBS_PATCH.");
      }

      const [ruleRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_actor_resource_rule_def
        WHERE code = 'HERBS_PATCH_REGEN'
        LIMIT 1
        `,
        { transaction }
      );

      let ruleId = Number(ruleRows?.[0]?.id ?? 0) || null;
      if (!ruleId) {
        await queryInterface.sequelize.query(
          `
          INSERT INTO ga_actor_resource_rule_def
            (code, name, actor_def_id, container_slot_role, item_def_id, refill_amount, refill_interval_ms, max_qty, is_active, created_at, updated_at)
          VALUES
            ('HERBS_PATCH_REGEN', 'Herbs Patch Regen', :actorDefId, 'LOOT', :itemDefId, 1, 300000, 10, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `,
          {
            transaction,
            replacements: {
              actorDefId: Number(herbsActorDefId),
              itemDefId: Number(herbsItemDefId),
            },
          }
        );

        const [insertedRuleRows] = await queryInterface.sequelize.query(
          `
          SELECT id
          FROM ga_actor_resource_rule_def
          WHERE code = 'HERBS_PATCH_REGEN'
          LIMIT 1
          `,
          { transaction }
        );
        ruleId = Number(insertedRuleRows?.[0]?.id ?? 0) || null;
      } else {
        await queryInterface.bulkUpdate(
          "ga_actor_resource_rule_def",
          {
            name: "Herbs Patch Regen",
            actor_def_id: Number(herbsActorDefId),
            container_slot_role: "LOOT",
            item_def_id: Number(herbsItemDefId),
            refill_amount: 1,
            refill_interval_ms: 300000,
            max_qty: 10,
            is_active: true,
            updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
          { id: ruleId },
          { transaction }
        );
      }

      if (!ruleId) {
        throw new Error("Nao foi possivel seedar a regra de regeneracao do Herbs.");
      }

      const ownerUserId = await findFirstUserId(queryInterface, transaction);
      if (!ownerUserId) {
        return;
      }

      for (const pos of HERBS_PATCH_POSITIONS) {
        await ensureResourceNode(
          queryInterface,
          Sequelize,
          transaction,
          {
            actorDefId: herbsActorDefId,
            containerDefId,
            containerSlotCount,
            itemDefId: herbsItemDefId,
            ruleDefId: ruleId,
            ownerUserId,
          },
          pos
        );
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [herbsActorRows] = await queryInterface.sequelize.query(
        `
        SELECT a.id
        FROM ga_actor_runtime a
        INNER JOIN ga_actor_def ad ON ad.id = a.actor_def_id
        WHERE ad.code = 'HERBS_PATCH'
          AND a.instance_id = 6
          AND (
            (a.pos_x = 35 AND a.pos_z = 22) OR
            (a.pos_x = 47 AND a.pos_z = 22)
          )
        `,
        { transaction }
      );

      for (const row of herbsActorRows ?? []) {
        const actorId = Number(row.id);
        if (!Number.isInteger(actorId) || actorId <= 0) continue;

        const [ownerRows] = await queryInterface.sequelize.query(
          `
          SELECT container_id
          FROM ga_container_owner
          WHERE owner_kind = 'ACTOR'
            AND owner_id = :actorId
            AND slot_role = 'LOOT'
          LIMIT 1
          `,
          {
            transaction,
            replacements: { actorId },
          }
        );

        const containerId = Number(ownerRows?.[0]?.container_id ?? 0) || null;
        if (containerId) {
          await queryInterface.bulkDelete("ga_container_slot", { container_id: containerId }, { transaction });
          await queryInterface.bulkDelete("ga_container_owner", { container_id: containerId }, { transaction });
          await queryInterface.bulkDelete("ga_container", { id: containerId }, { transaction });
        }

        await queryInterface.bulkDelete("ga_actor_resource_state", { actor_id: actorId }, { transaction });
        await queryInterface.bulkDelete("ga_actor_spawn", {
          instance_id: 6,
          pos_x: { [Sequelize.Op.in]: [35, 47] },
          pos_z: 22,
        }, { transaction }).catch(() => {});
        await queryInterface.bulkDelete("ga_actor_runtime", { id: actorId }, { transaction });
      }

      await queryInterface.bulkDelete("ga_actor_resource_rule_def", { code: "HERBS_PATCH_REGEN" }, { transaction });
      await queryInterface.bulkDelete("ga_actor_def", { code: "HERBS_PATCH" }, { transaction });
    });
  },
};
