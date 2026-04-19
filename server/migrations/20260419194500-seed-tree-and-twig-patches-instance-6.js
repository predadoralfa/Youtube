"use strict";

const TREE_POS = { x: 40, y: 0, z: 14 };
const TWIG_PATCH_POSITIONS = [
  { x: 36, y: 0, z: 14 },
  { x: 38, y: 0, z: 14 },
  { x: 42, y: 0, z: 14 },
  { x: 44, y: 0, z: 14 },
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
  const insertPayload = {
    ...payload,
  };
  const updatePayload = {
    ...payload,
  };
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

async function ensureSpawn(queryInterface, Sequelize, transaction, actorDefId, pos, stateJson) {
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
          state_json: JSON.stringify(stateJson),
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
    throw new Error(`Nao foi possivel seedar o actor em (${pos.x}, ${pos.z}).`);
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
    throw new Error(`Nao foi possivel seedar o spawn em (${pos.x}, ${pos.z}).`);
  }

  await queryInterface.bulkUpdate(
    "ga_actor_runtime",
    {
      actor_spawn_id: runtimeSpawnId,
      state_json: JSON.stringify(stateJson),
      status: "ACTIVE",
      updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    { id: runtimeActorId },
    { transaction }
  );

  return { actorId: runtimeActorId, spawnId: runtimeSpawnId };
}

async function ensureResourceNode(queryInterface, Sequelize, transaction, context, pos) {
  const { actorDefId, containerDefId, containerSlotCount, itemDefId, ruleDefId, ownerUserId } = context;

  const { actorId } = await ensureSpawn(
    queryInterface,
    Sequelize,
    transaction,
    actorDefId,
    pos,
    {
      resourceType: "TWIG_PATCH",
      visualHint: "TWIG",
    }
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
      actorId: Number(actorId),
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
      { containerDefId: Number(containerDefId) }
    );
  }

  if (!containerId) {
    throw new Error("Nao foi possivel localizar ou criar o container do twig.");
  }

  const ownerId = await findSingleId(
    queryInterface,
    transaction,
    `
    SELECT container_id AS id
    FROM ga_container_owner
    WHERE owner_kind = 'ACTOR'
      AND owner_id = :actorId
      AND slot_role = 'LOOT'
    LIMIT 1
    `,
    { actorId: Number(actorId) }
  );

  if (!ownerId) {
    await queryInterface.bulkInsert(
      "ga_container_owner",
      [
        {
          container_id: Number(containerId),
          owner_kind: "ACTOR",
          owner_id: Number(actorId),
          slot_role: "LOOT",
          created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
          updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      ],
      { transaction }
    );
  }

  const [slotRows] = await queryInterface.sequelize.query(
    `
    SELECT slot_index
    FROM ga_container_slot
    WHERE container_id = :containerId
    ORDER BY slot_index ASC
    `,
    {
      transaction,
      replacements: { containerId: Number(containerId) },
    }
  );

  if (!slotRows?.length) {
    const emptySlots = Array.from({ length: Number(containerSlotCount) }, (_, index) => ({
      container_id: Number(containerId),
      slot_index: index,
      item_instance_id: null,
      qty: 0,
    }));
    await queryInterface.bulkInsert("ga_container_slot", emptySlots, { transaction });
  }

  const [itemRows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_item_instance
    WHERE item_def_id = :itemDefId
      AND owner_user_id = :ownerUserId
      AND CAST(JSON_UNQUOTE(JSON_EXTRACT(props_json, '$.sourceActorId')) AS UNSIGNED) = :actorId
    ORDER BY id DESC
    LIMIT 1
    `,
    {
      transaction,
      replacements: {
        itemDefId: Number(itemDefId),
        ownerUserId: Number(ownerUserId),
        actorId: Number(actorId),
      },
    }
  );

  let itemInstanceId = Number(itemRows?.[0]?.id ?? 0) || null;
  if (!itemInstanceId) {
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
            sourceType: "TWIG_PATCH",
          }),
          created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
          updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      ],
      { transaction }
    );

    const [insertedItemRows] = await queryInterface.sequelize.query(
      `
      SELECT id
      FROM ga_item_instance
      WHERE item_def_id = :itemDefId
        AND owner_user_id = :ownerUserId
        AND CAST(JSON_UNQUOTE(JSON_EXTRACT(props_json, '$.sourceActorId')) AS UNSIGNED) = :actorId
      ORDER BY id DESC
      LIMIT 1
      `,
      {
        transaction,
        replacements: {
          itemDefId: Number(itemDefId),
          ownerUserId: Number(ownerUserId),
          actorId: Number(actorId),
        },
      }
    );

    itemInstanceId = Number(insertedItemRows?.[0]?.id ?? 0) || null;
  }

  if (!itemInstanceId) {
    throw new Error("Nao foi possivel seedar a instancia de graveto.");
  }

  await queryInterface.bulkUpdate(
    "ga_container_slot",
    {
      item_instance_id: Number(itemInstanceId),
      qty: 10,
    },
    {
      container_id: Number(containerId),
      slot_index: 0,
    },
    { transaction }
  );

  const [stateRows] = await queryInterface.sequelize.query(
    `
    SELECT actor_id
    FROM ga_actor_resource_state
    WHERE actor_id = :actorId
    LIMIT 1
    `,
    {
      transaction,
      replacements: { actorId: Number(actorId) },
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
      { actor_id: Number(actorId) },
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
        actorId: Number(actorId),
        ruleId: Number(ruleDefId),
        lastRefillAt: now,
        nextRefillAt,
      },
    }
  );
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const containerDef = await findLootContainerDef(queryInterface, transaction);
      const containerDefId = Number(containerDef?.id ?? 0) || null;
      const containerSlotCount = Number(containerDef?.slot_count ?? 0);
      if (!containerDefId || !Number.isInteger(containerSlotCount) || containerSlotCount < 1) {
        throw new Error("Nao encontrei container def reutilizavel para o twig.");
      }

      const ownerUserId = await findFirstUserId(queryInterface, transaction);
      if (!ownerUserId) {
        throw new Error("Nao foi possivel localizar um usuario para seedar o twig.");
      }

      const treeActorDefId = await findSingleId(
        queryInterface,
        transaction,
        `
        SELECT id
        FROM ga_actor_def
        WHERE code = 'TREE_APPLE'
        LIMIT 1
        `
      );

      if (!treeActorDefId) {
        throw new Error("Nao foi possivel localizar ga_actor_def TREE_APPLE.");
      }

      await ensureSpawn(
        queryInterface,
        Sequelize,
        transaction,
        treeActorDefId,
        TREE_POS,
        {
          resourceType: "APPLE_TREE",
          visualHint: "TREE",
        }
      );

      const twigItemDefId = await findSingleId(
        queryInterface,
        transaction,
        `
        SELECT id
        FROM ga_item_def
        WHERE code = 'GRAVETO'
        LIMIT 1
        `
      );

      if (!twigItemDefId) {
        throw new Error("Nao foi possivel localizar ga_item_def GRAVETO.");
      }

      const twigActorDefId = await upsertActorDef(queryInterface, Sequelize, transaction, {
        code: "TWIG_PATCH",
        name: "Twig Patch",
        actor_kind: "RESOURCE_NODE",
        visual_hint: "TWIG",
        asset_key: "Twig.glb",
        default_state_json: JSON.stringify({
          resourceType: "TWIG_PATCH",
          visualHint: "TWIG",
        }),
        default_container_def_id: containerDefId,
        is_active: true,
        created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
        updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
      });

      if (!twigActorDefId) {
        throw new Error("Nao foi possivel seedar o actor TWIG_PATCH.");
      }

      const [ruleRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_actor_resource_rule_def
        WHERE code = 'TWIG_PATCH_REGEN'
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
            ('TWIG_PATCH_REGEN', 'Twig Patch Regen', :actorDefId, 'LOOT', :itemDefId, 1, 300000, 10, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `,
          {
            transaction,
            replacements: {
              actorDefId: Number(twigActorDefId),
              itemDefId: Number(twigItemDefId),
            },
          }
        );

        const [insertedRuleRows] = await queryInterface.sequelize.query(
          `
          SELECT id
          FROM ga_actor_resource_rule_def
          WHERE code = 'TWIG_PATCH_REGEN'
          LIMIT 1
          `,
          { transaction }
        );
        ruleId = Number(insertedRuleRows?.[0]?.id ?? 0) || null;
      } else {
        await queryInterface.bulkUpdate(
          "ga_actor_resource_rule_def",
          {
            name: "Twig Patch Regen",
            actor_def_id: Number(twigActorDefId),
            container_slot_role: "LOOT",
            item_def_id: Number(twigItemDefId),
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
        throw new Error("Nao foi possivel seedar a regra de regeneracao do twig.");
      }

      for (const pos of TWIG_PATCH_POSITIONS) {
        await ensureResourceNode(
          queryInterface,
          Sequelize,
          transaction,
          {
            actorDefId: twigActorDefId,
            containerDefId,
            containerSlotCount,
            itemDefId: twigItemDefId,
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
      const [twigActorRows] = await queryInterface.sequelize.query(
        `
        SELECT a.id
        FROM ga_actor_runtime a
        INNER JOIN ga_actor_def ad ON ad.id = a.actor_def_id
        WHERE ad.code = 'TWIG_PATCH'
          AND a.instance_id = 6
          AND (
            (a.pos_x = 36 AND a.pos_z = 14) OR
            (a.pos_x = 38 AND a.pos_z = 14) OR
            (a.pos_x = 42 AND a.pos_z = 14) OR
            (a.pos_x = 44 AND a.pos_z = 14)
          )
        `,
        { transaction }
      );

      for (const row of twigActorRows ?? []) {
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
          pos_x: { [Sequelize.Op.in]: [36, 38, 42, 44] },
          pos_z: 14,
        }, { transaction }).catch(() => {});
        await queryInterface.bulkDelete("ga_actor_runtime", { id: actorId }, { transaction });
      }

      const [treeActorRows] = await queryInterface.sequelize.query(
        `
        SELECT a.id
        FROM ga_actor_runtime a
        INNER JOIN ga_actor_def ad ON ad.id = a.actor_def_id
        WHERE ad.code = 'TREE_DECOR'
          AND a.instance_id = 6
          AND a.pos_x = 40
          AND a.pos_z = 14
        LIMIT 1
        `,
        { transaction }
      );

      const treeActorId = Number(treeActorRows?.[0]?.id ?? 0) || null;
      if (treeActorId) {
        await queryInterface.bulkDelete("ga_actor_spawn", {
          instance_id: 6,
          pos_x: 40,
          pos_z: 14,
        }, { transaction }).catch(() => {});
        await queryInterface.bulkDelete("ga_actor_runtime", { id: treeActorId }, { transaction });
      }

      await queryInterface.bulkDelete("ga_actor_resource_rule_def", { code: "TWIG_PATCH_REGEN" }, { transaction });
      await queryInterface.bulkDelete("ga_actor_def", { code: "TWIG_PATCH" }, { transaction });
    });
  },
};
