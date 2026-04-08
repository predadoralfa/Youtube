"use strict";

const db = require("../../models");
const { createRuntimeActor, ensureActorContainer } = require("../actorService");
const { mergeStateParts } = require("./shared");

async function ensureRuntimeActorsForSpawns(instanceId, tx) {
  const spawnRows = await db.GaActorSpawn.findAll({
    where: {
      instance_id: instanceId,
      is_active: true,
    },
    include: [
      {
        association: "actorDef",
        required: true,
        where: { is_active: true },
      },
    ],
    order: [["id", "ASC"]],
    transaction: tx,
  });

  if (spawnRows.length === 0) return;

  const spawnIds = spawnRows.map((row) => Number(row.id));
  const runtimeRows = await db.GaActorRuntime.findAll({
    where: {
      instance_id: instanceId,
      actor_spawn_id: spawnIds,
    },
    transaction: tx,
  });

  const runtimeBySpawnId = new Map(
    runtimeRows
      .filter((row) => row.actor_spawn_id != null)
      .map((row) => [Number(row.actor_spawn_id), row])
  );

  for (const spawn of spawnRows) {
    const actorDef = spawn.actorDef;
    let runtime = runtimeBySpawnId.get(Number(spawn.id)) ?? null;

    if (!runtime) {
      const stateJson = mergeStateParts(
        actorDef?.default_state_json ?? null,
        spawn.state_override_json ?? null
      );

      const created = await createRuntimeActor(
        {
          actorDefId: actorDef.id,
          actorSpawnId: spawn.id,
          instanceId,
          posX: spawn.pos_x,
          posY: spawn.pos_y,
          posZ: spawn.pos_z,
          stateJson: Object.keys(stateJson).length > 0 ? stateJson : null,
          status: "ACTIVE",
          rev: Number(spawn.rev ?? 1),
          transaction: tx,
        }
      );

      runtime = created.actor;
      runtimeBySpawnId.set(Number(spawn.id), runtime);
    }

    const defaultContainerDefId = Number(actorDef?.default_container_def_id ?? 0);
    if (defaultContainerDefId > 0) {
      await ensureActorContainer(
        {
          actorId: runtime.id,
          containerDefId: defaultContainerDefId,
          slotRole: "LOOT",
        },
        tx
      );
    }
  }
}

module.exports = {
  ensureRuntimeActorsForSpawns,
};
