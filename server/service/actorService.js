"use strict";

const db = require("../models");

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function resolveActorDef(params, tx) {
  const actorDefId = Number(params?.actorDefId);
  const actorDefCode = String(
    params?.actorDefCode ??
    params?.actorType ??
    ""
  ).trim();

  if (Number.isInteger(actorDefId) && actorDefId > 0) {
    const actorDef = await db.GaActorDef.findByPk(actorDefId, { transaction: tx });
    if (!actorDef) {
      throw new Error(`resolveActorDef: ga_actor_def not found id=${actorDefId}`);
    }
    return actorDef;
  }

  if (!actorDefCode) {
    throw new Error("resolveActorDef: actorDefId or actorDefCode required");
  }

  const actorDef = await db.GaActorDef.findOne({
    where: { code: actorDefCode },
    transaction: tx,
  });

  if (!actorDef) {
    throw new Error(`resolveActorDef: ga_actor_def not found code=${actorDefCode}`);
  }

  return actorDef;
}

async function ensureActorContainer(params, tx) {
  const actorId = Number(params?.actorId);
  const slotRole = String(params?.slotRole || "LOOT").trim();
  const containerDefId = Number(params?.containerDefId);

  if (!Number.isInteger(actorId) || actorId <= 0) {
    throw new Error("ensureActorContainer: actorId invalid");
  }

  if (!Number.isInteger(containerDefId) || containerDefId <= 0) {
    throw new Error("ensureActorContainer: containerDefId invalid");
  }

  const existingOwner = await db.GaContainerOwner.findOne({
    where: {
      owner_kind: "ACTOR",
      owner_id: actorId,
      slot_role: slotRole,
    },
    include: {
      association: "container",
      required: false,
    },
    transaction: tx,
  });

  if (existingOwner?.container) {
    return {
      owner: existingOwner,
      container: existingOwner.container,
      created: false,
    };
  }

  const containerDef = await db.GaContainerDef.findByPk(containerDefId, { transaction: tx });
  if (!containerDef) {
    throw new Error(`ensureActorContainer: ga_container_def not found id=${containerDefId}`);
  }

  const slotCount = Number(containerDef.slot_count);
  if (!Number.isInteger(slotCount) || slotCount < 1) {
    throw new Error(`ensureActorContainer: invalid slot_count=${containerDef.slot_count} for def=${containerDefId}`);
  }

  const now = new Date();

  const container = await db.GaContainer.create(
    {
      container_def_id: containerDefId,
      slot_role: slotRole,
      state: "ACTIVE",
      rev: 1,
      created_at: now,
      updated_at: now,
    },
    { transaction: tx }
  );

  const owner = await db.GaContainerOwner.create(
    {
      container_id: container.id,
      owner_kind: "ACTOR",
      owner_id: actorId,
      slot_role: slotRole,
    },
    { transaction: tx }
  );

  const slots = Array.from({ length: slotCount }, (_, i) => ({
    container_id: container.id,
    slot_index: i,
    item_instance_id: null,
    qty: 0,
  }));

  await db.GaContainerSlot.bulkCreate(slots, { transaction: tx });

  return {
    owner,
    container,
    created: true,
  };
}

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
  ensureActorContainer,
  resolveActorDef,
};
