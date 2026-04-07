"use strict";

const TARGET = {
  instanceId: 6,
  pos: { x: 31, y: 0, z: 22 },
  actorCode: "CHEST_TEST",
};

async function findChestActorDef(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id, default_state_json
    FROM ga_actor_def
    WHERE code = :actorCode
    LIMIT 1
    `,
    {
      transaction,
      replacements: { actorCode: TARGET.actorCode },
    }
  );

  return rows?.[0] ?? null;
}

async function ensureChestSpawn(queryInterface, transaction, actorDefId) {
  const [existingRows] = await queryInterface.sequelize.query(
    `
    SELECT id, rev
    FROM ga_actor_spawn
    WHERE instance_id = :instanceId
      AND actor_def_id = :actorDefId
      AND pos_x = :posX
      AND pos_y = :posY
      AND pos_z = :posZ
    LIMIT 1
    `,
    {
      transaction,
      replacements: {
        instanceId: TARGET.instanceId,
        actorDefId: Number(actorDefId),
        posX: TARGET.pos.x,
        posY: TARGET.pos.y,
        posZ: TARGET.pos.z,
      },
    }
  );

  if (existingRows?.[0]) {
    return {
      id: Number(existingRows[0].id),
      rev: Number(existingRows[0].rev ?? 1),
    };
  }

  const now = new Date();
  await queryInterface.bulkInsert(
    "ga_actor_spawn",
    [
      {
        instance_id: TARGET.instanceId,
        actor_def_id: Number(actorDefId),
        pos_x: TARGET.pos.x,
        pos_y: TARGET.pos.y,
        pos_z: TARGET.pos.z,
        state_override_json: null,
        is_active: true,
        rev: 1,
        created_at: now,
        updated_at: now,
      },
    ],
    { transaction }
  );

  const [insertedRows] = await queryInterface.sequelize.query(
    `
    SELECT id, rev
    FROM ga_actor_spawn
    WHERE instance_id = :instanceId
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
        instanceId: TARGET.instanceId,
        actorDefId: Number(actorDefId),
        posX: TARGET.pos.x,
        posY: TARGET.pos.y,
        posZ: TARGET.pos.z,
      },
    }
  );

  const spawnRow = insertedRows?.[0] ?? null;
  if (!spawnRow?.id) {
    throw new Error("Falha ao criar ga_actor_spawn para CHEST_TEST na instancia 6.");
  }

  return {
    id: Number(spawnRow.id),
    rev: Number(spawnRow.rev ?? 1),
  };
}

async function ensureChestRuntime(queryInterface, transaction, actorDef, spawn) {
  const [runtimeRows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_actor
    WHERE actor_spawn_id = :spawnId
    LIMIT 1
    `,
    {
      transaction,
      replacements: { spawnId: Number(spawn.id) },
    }
  );

  if (runtimeRows?.[0]?.id) return;

  const now = new Date();
  const defaultState =
    actorDef?.default_state_json ??
    JSON.stringify({
      visualHint: "CHEST",
    });

  await queryInterface.bulkInsert(
    "ga_actor",
    [
      {
        actor_def_id: Number(actorDef.id),
        actor_spawn_id: Number(spawn.id),
        instance_id: TARGET.instanceId,
        pos_x: TARGET.pos.x,
        pos_y: TARGET.pos.y,
        pos_z: TARGET.pos.z,
        state_json: defaultState,
        status: "ACTIVE",
        rev: Number(spawn.rev ?? 1),
        created_at: now,
        updated_at: now,
      },
    ],
    { transaction }
  );
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const actorDef = await findChestActorDef(queryInterface, transaction);
      if (!actorDef?.id) {
        throw new Error(
          "Nao encontrei ga_actor_def CHEST_TEST. Rode primeiro a migration que cria os actor_defs."
        );
      }

      const spawn = await ensureChestSpawn(queryInterface, transaction, actorDef.id);
      await ensureChestRuntime(queryInterface, transaction, actorDef, spawn);
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const actorDef = await findChestActorDef(queryInterface, transaction);
      if (!actorDef?.id) return;

      const [spawnRows] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM ga_actor_spawn
        WHERE instance_id = :instanceId
          AND actor_def_id = :actorDefId
          AND pos_x = :posX
          AND pos_y = :posY
          AND pos_z = :posZ
        `,
        {
          transaction,
          replacements: {
            instanceId: TARGET.instanceId,
            actorDefId: Number(actorDef.id),
            posX: TARGET.pos.x,
            posY: TARGET.pos.y,
            posZ: TARGET.pos.z,
          },
        }
      );

      const spawnIds = (spawnRows ?? [])
        .map((row) => Number(row.id))
        .filter((id) => Number.isInteger(id) && id > 0);

      if (spawnIds.length === 0) return;

      await queryInterface.bulkDelete(
        "ga_actor",
        { actor_spawn_id: { [Sequelize.Op.in]: spawnIds } },
        { transaction }
      );

      await queryInterface.bulkDelete(
        "ga_actor_spawn",
        { id: { [Sequelize.Op.in]: spawnIds } },
        { transaction }
      );
    });
  },
};

