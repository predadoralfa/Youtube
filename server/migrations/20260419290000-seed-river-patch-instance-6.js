"use strict";

const RIVER_PATCH_POSITIONS = [
  { x: 18, y: 0, z: 30 },
  { x: 32, y: 0, z: 30 },
  { x: 46, y: 0, z: 30 },
];

async function findSingleId(queryInterface, transaction, sql, replacements = {}) {
  const [rows] = await queryInterface.sequelize.query(sql, { transaction, replacements });
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
    { transaction, replacements: { code: payload.code } }
  );

  const existingId = Number(rows?.[0]?.id ?? 0) || null;
  const updatePayload = { ...payload };
  delete updatePayload.created_at;
  delete updatePayload.updated_at;

  if (!existingId) {
    await queryInterface.bulkInsert("ga_actor_def", [payload], { transaction });
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

async function ensureRiverNode(queryInterface, Sequelize, transaction, actorDefId, pos) {
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
            resourceType: "RIVER_PATCH",
            visualHint: "WATER",
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
    throw new Error(`Nao foi possivel seedar o river patch em (${pos.x}, ${pos.z}).`);
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
    throw new Error(`Nao foi possivel seedar o spawn do river patch em (${pos.x}, ${pos.z}).`);
  }

  await queryInterface.bulkUpdate(
    "ga_actor_runtime",
    {
      actor_spawn_id: runtimeSpawnId,
      state_json: JSON.stringify({
        resourceType: "RIVER_PATCH",
        visualHint: "WATER",
      }),
      status: "ACTIVE",
      updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    { id: runtimeActorId },
    { transaction }
  );
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const riverActorDefPayload = {
        code: "RIVER_PATCH",
        name: "River Patch",
        actor_kind: "WATER_SOURCE",
        visual_hint: "WATER",
        asset_key: "RIVER_PATCH",
        default_state_json: JSON.stringify({
          resourceType: "RIVER_PATCH",
          visualHint: "WATER",
        }),
        default_container_def_id: null,
        is_active: true,
        created_at: Sequelize.literal("CURRENT_TIMESTAMP"),
        updated_at: Sequelize.literal("CURRENT_TIMESTAMP"),
      };

      const riverActorDefId = await upsertActorDef(
        queryInterface,
        Sequelize,
        transaction,
        riverActorDefPayload
      );

      if (!riverActorDefId) {
        throw new Error("Nao foi possivel seedar o actor RIVER_PATCH.");
      }

      for (const pos of RIVER_PATCH_POSITIONS) {
        await ensureRiverNode(queryInterface, Sequelize, transaction, riverActorDefId, pos);
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [riverActorRows] = await queryInterface.sequelize.query(
        `
        SELECT a.id
        FROM ga_actor_runtime a
        INNER JOIN ga_actor_def ad ON ad.id = a.actor_def_id
        WHERE ad.code = 'RIVER_PATCH'
          AND a.instance_id = 6
          AND (
            (a.pos_x = 18 AND a.pos_z = 30) OR
            (a.pos_x = 32 AND a.pos_z = 30) OR
            (a.pos_x = 46 AND a.pos_z = 30)
          )
        `,
        { transaction }
      );

      for (const row of riverActorRows ?? []) {
        const actorId = Number(row.id);
        if (!Number.isInteger(actorId) || actorId <= 0) continue;

        const [spawnRows] = await queryInterface.sequelize.query(
          `
          SELECT id
          FROM ga_actor_spawn
          WHERE instance_id = 6
            AND actor_def_id = (SELECT id FROM ga_actor_def WHERE code = 'RIVER_PATCH' LIMIT 1)
            AND (
              (pos_x = 18 AND pos_z = 30) OR
              (pos_x = 32 AND pos_z = 30) OR
              (pos_x = 46 AND pos_z = 30)
            )
          LIMIT 1
          `,
          { transaction }
        );

        const spawnId = Number(spawnRows?.[0]?.id ?? 0) || null;
        if (spawnId) {
          await queryInterface.bulkDelete("ga_actor_spawn", { id: spawnId }, { transaction });
        }

        await queryInterface.bulkDelete("ga_actor_runtime", { id: actorId }, { transaction });
      }

      await queryInterface.bulkDelete("ga_actor_def", { code: "RIVER_PATCH" }, { transaction });
    });
  },
};
