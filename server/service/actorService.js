// server/service/actorService.js
"use strict";

const db = require("../models");

/**
 * createActorWithContainer(params)
 *
 * Cria um actor persistente e já anexa um container a ele via ga_container_owner.
 * Sem gameplay. Sem sockets. Apenas infraestrutura.
 *
 * Params:
 * - actorType (string)         : ex "CHEST", "TREE", "NPC"
 * - instanceId (number)        : ga_instance.id (INT)
 * - posX (number)              : default 0
 * - posY (number)              : default 0
 * - stateJson (object|null)    : default null
 * - status ("ACTIVE"|"DISABLED"): default "ACTIVE"
 *
 * - containerDefId (number)    : ga_container_def.id (define slot_count)
 * - slotRole (string)          : ex "INVENTORY", "LOOT", "RESOURCE_OUTPUT" (default "INVENTORY")
 *
 * Returns:
 * { actor, container, owner }
 */
async function createActorWithContainer(params) {
  const actorType = String(params?.actorType || "").trim();
  const instanceId = Number(params?.instanceId);
  const posX = Number.isFinite(Number(params?.posX)) ? Number(params.posX) : 0;
  const posY = Number.isFinite(Number(params?.posY)) ? Number(params.posY) : 0;
  const stateJson = params?.stateJson ?? null;
  const status = (params?.status || "ACTIVE").toUpperCase();

  const containerDefId = Number(params?.containerDefId);
  const slotRole = String(params?.slotRole || "INVENTORY").trim();

  if (!actorType) throw new Error("createActorWithContainer: actorType required");
  if (!Number.isInteger(instanceId) || instanceId <= 0)
    throw new Error("createActorWithContainer: instanceId invalid");
  if (!Number.isInteger(containerDefId) || containerDefId <= 0)
    throw new Error("createActorWithContainer: containerDefId invalid");
  if (!slotRole) throw new Error("createActorWithContainer: slotRole required");
  if (status !== "ACTIVE" && status !== "DISABLED")
    throw new Error("createActorWithContainer: status invalid");

  const run = async (tx) => {
    const now = new Date();

    // 1) valida instance existe
    const inst = await db.GaInstance.findByPk(instanceId, { transaction: tx });
    if (!inst) throw new Error(`createActorWithContainer: ga_instance not found id=${instanceId}`);

    // 2) carrega container_def para obter slot_count
    const def = await db.GaContainerDef.findByPk(containerDefId, { transaction: tx });
    if (!def) throw new Error(`createActorWithContainer: ga_container_def not found id=${containerDefId}`);

    const slotCount = Number(def.slot_count);
    if (!Number.isInteger(slotCount) || slotCount < 1) {
      throw new Error(`createActorWithContainer: invalid slot_count=${def.slot_count} for def=${containerDefId}`);
    }

    // 3) cria actor
    const actor = await db.GaActor.create(
      {
        actor_type: actorType,
        instance_id: instanceId,
        pos_x: posX,
        pos_y: posY,
        state_json: stateJson,
        status,
      },
      { transaction: tx }
    );

    // 4) cria container (genérico)
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

    // 5) cria ownership ACTOR -> container
    // UNIQUE(owner_kind, owner_id, slot_role) garante 1 role por actor
    const owner = await db.GaContainerOwner.create(
      {
        container_id: container.id,
        owner_kind: "ACTOR",
        owner_id: actor.id,
        slot_role: slotRole,
      },
      { transaction: tx }
    );

    // 6) cria slots vazios
    const slots = Array.from({ length: slotCount }, (_, i) => ({
      container_id: container.id,
      slot_index: i,
      item_instance_id: null,
      qty: 0,
    }));

    await db.GaContainerSlot.bulkCreate(slots, { transaction: tx });

    return { actor, container, owner };
  };

  if (params?.transaction) {
    return await run(params.transaction);
  }

  return await db.sequelize.transaction(async (tx) => run(tx));
}

module.exports = {
  createActorWithContainer,
};
