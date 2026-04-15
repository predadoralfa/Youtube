"use strict";

function levelTimeMs(level) {
  return 300000 * Math.pow(3, level - 1);
}

function fiberCost(level) {
  if (level <= 1) return null;
  return 10 * Math.pow(3, level - 2);
}

function levelRequirements(level) {
  if (level <= 1) return null;
  return {
    requiresLevel: level - 1,
    itemCosts: [
      {
        itemCode: "FIBER",
        qty: fiberCost(level),
      },
    ],
  };
}

async function upsertByCode(queryInterface, transaction, tableName, code, payload) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ${tableName}
    WHERE code = :code
    LIMIT 1
    `,
    { transaction, replacements: { code } }
  );

  const id = Number(rows?.[0]?.id ?? 0) || null;
  if (!id) {
    await queryInterface.bulkInsert(tableName, [payload], { transaction });
    const [insertedRows] = await queryInterface.sequelize.query(
      `
      SELECT id
      FROM ${tableName}
      WHERE code = :code
      LIMIT 1
      `,
      { transaction, replacements: { code } }
    );
    return Number(insertedRows?.[0]?.id ?? 0) || null;
  }

  await queryInterface.bulkUpdate(tableName, payload, { id }, { transaction });
  return id;
}

async function upsertResearchLevel(queryInterface, transaction, researchDefId, level) {
  const [levelRows] = await queryInterface.sequelize.query(
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

  if (levelRows?.[0]?.id) {
    await queryInterface.bulkUpdate("ga_research_level_def", payload, { id: levelRows[0].id }, { transaction });
  } else {
    await queryInterface.bulkInsert("ga_research_level_def", [payload], { transaction });
  }
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

  return rows?.[0]?.id ?? null;
}

async function ensureFiberPatchSeed(queryInterface, Sequelize, transaction, actorDefId, containerDefId, containerSlotCount, fiberItemDefId, ownerUserId) {
  const pos = { x: 39, y: 0, z: 22 };

  const [actorRows] = await queryInterface.sequelize.query(
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
      transaction,
      replacements: {
        actorDefId,
        posX: pos.x,
        posY: pos.y,
        posZ: pos.z,
      },
    }
  );

  let actorId = Number(actorRows?.[0]?.id ?? 0) || null;
  if (!actorId) {
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

    const [insertedActorRows] = await queryInterface.sequelize.query(
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
        transaction,
        replacements: {
          actorDefId,
          posX: pos.x,
          posY: pos.y,
          posZ: pos.z,
        },
      }
    );

    actorId = Number(insertedActorRows?.[0]?.id ?? 0) || null;
  }

  if (!actorId) {
    throw new Error("Nao foi possivel seedar o actor FIBER_PATCH.");
  }

  const [spawnRows] = await queryInterface.sequelize.query(
    `
    SELECT id, rev
    FROM ga_actor_spawn
    WHERE instance_id = 6
      AND actor_def_id = :actorDefId
      AND pos_x = :posX
      AND pos_y = :posY
      AND pos_z = :posZ
    LIMIT 1
    `,
    {
      transaction,
      replacements: {
        actorDefId,
        posX: pos.x,
        posY: pos.y,
        posZ: pos.z,
      },
    }
  );

  let spawnId = Number(spawnRows?.[0]?.id ?? 0) || null;
  let spawnRev = Number(spawnRows?.[0]?.rev ?? 1) || 1;

  if (!spawnId) {
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

    const [insertedSpawnRows] = await queryInterface.sequelize.query(
      `
      SELECT id, rev
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
        transaction,
        replacements: {
          actorDefId,
          posX: pos.x,
          posY: pos.y,
          posZ: pos.z,
        },
      }
    );

    spawnId = Number(insertedSpawnRows?.[0]?.id ?? 0) || null;
    spawnRev = Number(insertedSpawnRows?.[0]?.rev ?? 1) || 1;
  }

  if (!spawnId) {
    throw new Error("Nao foi possivel seedar o spawn da fibra.");
  }

  await queryInterface.bulkUpdate(
    "ga_actor_runtime",
    {
      actor_spawn_id: Number(spawnId),
      state_json: JSON.stringify({
        resourceType: "FIBER_PATCH",
        visualHint: "GRASS",
      }),
      status: "ACTIVE",
      rev: Number(spawnRev ?? 1),
      updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    { id: Number(actorId) },
    { transaction }
  );

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
      replacements: {
        actorId: Number(actorId),
      },
    }
  );

  let containerId = Number(containerRows?.[0]?.id ?? 0) || null;
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

    const [insertedContainerRows] = await queryInterface.sequelize.query(
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

    containerId = Number(insertedContainerRows?.[0]?.id ?? 0) || null;
  }

  if (!containerId) {
    throw new Error("Nao foi possivel localizar ou criar o container da fibra.");
  }

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
      replacements: { actorId: Number(actorId) },
    }
  );

  if (!ownerRows?.[0]) {
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
      replacements: {
        containerId: Number(containerId),
      },
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
        itemDefId: Number(fiberItemDefId),
        ownerUserId: Number(ownerUserId),
      },
    }
  );

  let fiberItemInstanceId = Number(fiberInstanceRows?.[0]?.id ?? 0) || null;
  if (!fiberItemInstanceId) {
    await queryInterface.bulkInsert(
      "ga_item_instance",
      [
        {
          item_def_id: Number(fiberItemDefId),
          owner_user_id: Number(ownerUserId),
          bind_state: "NONE",
          durability: null,
          props_json: JSON.stringify({
            sourceActorId: Number(actorId),
            sourceType: "FIBER_PATCH",
          }),
          created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
          updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      ],
      { transaction }
    );

    const [insertedFiberRows] = await queryInterface.sequelize.query(
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
          itemDefId: Number(fiberItemDefId),
          ownerUserId: Number(ownerUserId),
        },
      }
    );

    fiberItemInstanceId = Number(insertedFiberRows?.[0]?.id ?? 0) || null;
  }

  if (!fiberItemInstanceId) {
    throw new Error("Nao foi possivel seedar a instancia da fibra.");
  }

  await queryInterface.bulkUpdate(
    "ga_container_slot",
    {
      item_instance_id: Number(fiberItemInstanceId),
      qty: 10,
    },
    {
      container_id: Number(containerId),
      slot_index: 0,
    },
    { transaction }
  );

  const [ruleRows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_actor_resource_rule_def
    WHERE code = 'FIBER_PATCH_REGEN'
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
        ('FIBER_PATCH_REGEN', 'Fiber Patch Regen', :actorDefId, 'LOOT', :itemDefId, 1, 300000, 10, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      {
        transaction,
        replacements: {
          actorDefId: Number(actorDefId),
          itemDefId: Number(fiberItemDefId),
        },
      }
    );

    const [insertedRuleRows] = await queryInterface.sequelize.query(
      `
      SELECT id
      FROM ga_actor_resource_rule_def
      WHERE code = 'FIBER_PATCH_REGEN'
      LIMIT 1
      `,
      { transaction }
    );
    ruleId = Number(insertedRuleRows?.[0]?.id ?? 0) || null;
  }

  if (!ruleId) {
    throw new Error("Nao foi possivel seedar a regra de regeneracao da fibra.");
  }

  const now = new Date();
  const nextRefill = new Date(now.getTime() + 300000);

  await queryInterface.sequelize.query(
    `
    INSERT INTO ga_actor_resource_state
      (actor_id, rule_def_id, current_qty, last_refill_at, next_refill_at, state, rev, created_at, updated_at)
    VALUES
      (:actorId, :ruleId, 10, :lastRefillAt, :nextRefillAt, 'ACTIVE', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE
      rule_def_id = VALUES(rule_def_id),
      current_qty = VALUES(current_qty),
      last_refill_at = VALUES(last_refill_at),
      next_refill_at = VALUES(next_refill_at),
      state = 'ACTIVE',
      updated_at = CURRENT_TIMESTAMP
    `,
    {
      transaction,
      replacements: {
        actorId: Number(actorId),
        ruleId: Number(ruleId),
        lastRefillAt: now,
        nextRefillAt: nextRefill,
      },
    }
  );
}

module.exports = {
  async up(queryInterface, Sequelize) {
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
        throw new Error("Nao foi possivel localizar a Era 1 para seed de fibra.");
      }

      const [fiberRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_item_def
        WHERE code = 'FIBER'
        LIMIT 1
        `,
        { transaction }
      );

      const fiberItemDefId = Number(fiberRows?.[0]?.id ?? 0) || null;
      if (!fiberItemDefId) {
        throw new Error("Nao foi possivel localizar FIBER para seed de fibra.");
      }

      await queryInterface.bulkUpdate(
        "ga_item_def",
        {
          code: "FIBER",
          name: "Fiber",
          category: "MATERIAL",
          stack_max: 100,
          unit_weight: 0.2,
          era_min_id: eraMinId,
          is_active: true,
        },
        { id: fiberItemDefId },
        { transaction }
      );

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

      const lootContainerDefId = Number(lootContainerDef?.[0]?.id ?? 0) || null;
      const lootContainerSlotCount = Number(lootContainerDef?.[0]?.slot_count ?? 0) || 0;
      if (!lootContainerDefId || lootContainerSlotCount < 1) {
        throw new Error("Nao encontrei container de loot para a fibra.");
      }

      const [actorDefRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_actor_def
        WHERE code = 'FIBER_PATCH'
        LIMIT 1
        `,
        { transaction }
      );

      let actorDefId = Number(actorDefRows?.[0]?.id ?? 0) || null;
      const actorPayload = {
        code: "FIBER_PATCH",
        name: "Fiber Patch",
        actor_kind: "RESOURCE_NODE",
        visual_hint: "GRASS",
        asset_key: "GRASS",
        default_state_json: JSON.stringify({
          resourceType: "FIBER_PATCH",
          visualHint: "GRASS",
        }),
        default_container_def_id: lootContainerDefId,
        is_active: true,
        created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
        updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
      };

      if (!actorDefId) {
        await queryInterface.bulkInsert("ga_actor_def", [actorPayload], { transaction });
        const [insertedActorDefRows] = await queryInterface.sequelize.query(
          `
          SELECT id
          FROM ga_actor_def
          WHERE code = 'FIBER_PATCH'
          LIMIT 1
          `,
          { transaction }
        );
        actorDefId = Number(insertedActorDefRows?.[0]?.id ?? 0) || null;
      } else {
        await queryInterface.bulkUpdate("ga_actor_def", actorPayload, { id: actorDefId }, { transaction });
      }

      if (!actorDefId) {
        throw new Error("Nao foi possivel seedar o actor FIBER_PATCH.");
      }

      const [researchRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_research_def
        WHERE code IN ('RESEARCH_PRIMITIVE_SHELTER', 'RESEARCH_FIBER')
        ORDER BY CASE code
          WHEN 'RESEARCH_FIBER' THEN 0
          ELSE 1
        END
        LIMIT 1
        `,
        { transaction }
      );

      let researchDefId = Number(researchRows?.[0]?.id ?? 0) || null;
      const researchPayload = {
        code: "RESEARCH_FIBER",
        name: "Fiber",
        description: "Study wild fiber and unlock the first practical uses of grass patches.",
        item_def_id: fiberItemDefId,
        era_min_id: eraMinId,
        max_level: 5,
        is_active: true,
      };

      if (!researchDefId) {
        await queryInterface.bulkInsert("ga_research_def", [researchPayload], { transaction });
        const [insertedResearchRows] = await queryInterface.sequelize.query(
          `
          SELECT id
          FROM ga_research_def
          WHERE code = 'RESEARCH_FIBER'
          LIMIT 1
          `,
          { transaction }
        );
        researchDefId = Number(insertedResearchRows?.[0]?.id ?? 0) || null;
      } else {
        await queryInterface.bulkUpdate("ga_research_def", researchPayload, { id: researchDefId }, { transaction });
      }

      if (!researchDefId) {
        throw new Error("Nao foi possivel seedar o research RESEARCH_FIBER.");
      }

      const levels = [
        {
          level: 1,
          title: "Gathering Interest",
          description: "Make fiber an item of interest and unlock collecting it from grass patches.",
          grants: { unlock: ["actor.collect:FIBER_PATCH"] },
          requirements: null,
        },
        {
          level: 2,
          title: "Bundle Basics",
          description: "Reduce the carried weight of each fiber by 50 grams.",
          grants: { unlock: ["item.weight_delta:FIBER:-0.05"] },
          requirements: levelRequirements(2),
        },
        {
          level: 3,
          title: "Basket Weaving",
          description: "Unlock the first basket craft and the path toward extra hand storage.",
          grants: { unlock: ["recipe.craft:BASKET"] },
          requirements: levelRequirements(3),
        },
        {
          level: 4,
          title: "Carry Training",
          description: "Prepare future expansion into higher-capacity fiber handling.",
          grants: { unlock: [] },
          requirements: levelRequirements(4),
        },
        {
          level: 5,
          title: "Fiber Mastery",
          description: "Reach full mastery over the known uses of fiber in this era.",
          grants: { unlock: [] },
          requirements: levelRequirements(5),
        },
      ];

      for (const level of levels) {
        await upsertResearchLevel(queryInterface, transaction, researchDefId, level);
      }

      await ensureFiberPatchSeed(
        queryInterface,
        Sequelize,
        transaction,
        actorDefId,
        lootContainerDefId,
        lootContainerSlotCount,
        fiberItemDefId,
        await findFirstUserId(queryInterface, transaction)
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [researchRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_research_def
        WHERE code = 'RESEARCH_FIBER'
        LIMIT 1
        `,
        { transaction }
      );

      const researchDefId = Number(researchRows?.[0]?.id ?? 0) || null;
      if (researchDefId) {
        await queryInterface.bulkDelete("ga_user_research", { research_def_id: researchDefId }, { transaction });
        await queryInterface.bulkDelete("ga_research_level_def", { research_def_id: researchDefId }, { transaction });
        await queryInterface.bulkDelete("ga_research_def", { id: researchDefId }, { transaction });
      }

      const [actorRows] = await queryInterface.sequelize.query(
        `
        SELECT a.id
        FROM ga_actor_runtime a
        INNER JOIN ga_actor_def ad ON ad.id = a.actor_def_id
        WHERE ad.code = 'FIBER_PATCH'
        LIMIT 1
        `,
        { transaction }
      );

      const actorId = Number(actorRows?.[0]?.id ?? 0) || null;
      if (actorId) {
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
          await queryInterface.bulkDelete(
            "ga_container_owner",
            { container_id: containerId },
            { transaction }
          );
          await queryInterface.bulkDelete("ga_container", { id: containerId }, { transaction });
        }

        await queryInterface.bulkDelete("ga_actor_resource_state", { actor_id: actorId }, { transaction });
        await queryInterface.bulkDelete("ga_actor_runtime", { id: actorId }, { transaction });
      }

      await queryInterface.bulkDelete("ga_actor_resource_rule_def", { code: "FIBER_PATCH_REGEN" }, { transaction });

      await queryInterface.bulkDelete(
        "ga_actor_spawn",
        {
          instance_id: 6,
          pos_x: 39,
          pos_y: 0,
          pos_z: 22,
        },
        { transaction }
      );

      await queryInterface.bulkDelete("ga_actor_def", { code: "FIBER_PATCH" }, { transaction });
    });
  },
};
