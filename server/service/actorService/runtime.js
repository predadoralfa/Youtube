"use strict";

const db = require("../../models");
const { toFiniteNumber } = require("./shared");
const { resolveActorDef } = require("./defs");
const { ensureActorContainer } = require("./containers");

async function createRuntimeActor(params) {
  const instanceId = Number(params?.instanceId);
  const actorSpawnId = params?.actorSpawnId == null ? null : Number(params.actorSpawnId);
  const posX = toFiniteNumber(params?.posX, 0);
  const posY = toFiniteNumber(params?.posY, 0);
  const posZ = toFiniteNumber(params?.posZ, 0);
  const stateJson = params?.stateJson ?? null;
  const status = String(params?.status || "ACTIVE").toUpperCase();
  const rev = Number.isFinite(Number(params?.rev)) ? Number(params.rev) : 1;

  if (!Number.isInteger(instanceId) || instanceId <= 0) {
    throw new Error("createRuntimeActor: instanceId invalid");
  }

  if (status !== "ACTIVE" && status !== "DISABLED") {
    throw new Error("createRuntimeActor: status invalid");
  }

  const run = async (tx) => {
    const actorDef = await resolveActorDef(params, tx);
    const instance = await db.GaInstance.findByPk(instanceId, { transaction: tx });
    if (!instance) {
      throw new Error(`createRuntimeActor: ga_instance not found id=${instanceId}`);
    }

    const actor = await db.GaActorRuntime.create(
      {
        actor_def_id: actorDef.id,
        actor_spawn_id: Number.isInteger(actorSpawnId) && actorSpawnId > 0 ? actorSpawnId : null,
        instance_id: instanceId,
        pos_x: posX,
        pos_y: posY,
        pos_z: posZ,
        state_json: stateJson,
        status,
        rev,
      },
      { transaction: tx }
    );

    return { actor, actorDef };
  };

  if (params?.transaction) {
    return run(params.transaction);
  }

  return db.sequelize.transaction((tx) => run(tx));
}

async function createActorWithContainer(params) {
  const slotRole = String(params?.slotRole || "LOOT").trim();

  const run = async (tx) => {
    const { actor, actorDef } = await createRuntimeActor({
      ...params,
      transaction: tx,
    });

    const resolvedContainerDefId = Number(
      params?.containerDefId ??
        actorDef.default_container_def_id ??
        0
    );

    if (!Number.isInteger(resolvedContainerDefId) || resolvedContainerDefId <= 0) {
      throw new Error("createActorWithContainer: containerDefId invalid");
    }

    const { owner, container } = await ensureActorContainer(
      {
        actorId: actor.id,
        containerDefId: resolvedContainerDefId,
        slotRole,
      },
      tx
    );

    return { actor, actorDef, container, owner };
  };

  if (params?.transaction) {
    return run(params.transaction);
  }

  return db.sequelize.transaction((tx) => run(tx));
}

module.exports = {
  createRuntimeActor,
  createActorWithContainer,
};
