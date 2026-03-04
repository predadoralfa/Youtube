// server/service/actorLoader.js
"use strict";

const db = require("../models");

/**
 * loadActorsForInstance(instanceId, opts?)
 *
 * Carrega actors persistentes de uma instância (spawn list) e, opcionalmente,
 * anexa referências de containers (slot_role + container_id + container_def_id).
 *
 * Não carrega slots/itens. Isso é outro passo (inventory runtime específico de actor),
 * e não é necessário para "spawnar no mundo".
 *
 * opts:
 * - includeContainers: boolean (default true)
 * - status: "ACTIVE" | "DISABLED" | null (default "ACTIVE")
 */
async function loadActorsForInstance(instanceIdRaw, opts = {}) {
  const instanceId = Number(instanceIdRaw);
  if (!Number.isInteger(instanceId) || instanceId <= 0) {
    throw new Error(`loadActorsForInstance: invalid instanceId=${instanceIdRaw}`);
  }

  const includeContainers = opts.includeContainers !== false;
  const status = opts.status === undefined ? "ACTIVE" : opts.status;

  const where = { instance_id: instanceId };
  if (status != null) where.status = status;

  // 1) actors
  const actorRows = await db.GaActor.findAll({
    where,
    attributes: ["id", "actor_type", "instance_id", "pos_x", "pos_y", "state_json", "status"],
    order: [["id", "ASC"]],
  });

  const actors = actorRows.map((r) => {
    const a = r.get({ plain: true });
    return {
      id: Number(a.id),
      actorType: a.actor_type,
      instanceId: Number(a.instance_id),
      pos: { x: Number(a.pos_x ?? 0), y: Number(a.pos_y ?? 0) },
      status: a.status,
      state: a.state_json ?? null,

      // preenchido abaixo se includeContainers=true
      containers: [],
    };
  });

  if (!includeContainers || actors.length === 0) return actors;

  const actorIds = actors.map((a) => a.id);

  // 2) owners (ACTOR -> container)
  const ownerRows = await db.GaContainerOwner.findAll({
    where: {
      owner_kind: "ACTOR",
      owner_id: actorIds, // IN (...)
    },
    attributes: ["container_id", "owner_id", "slot_role"],
    order: [
      ["owner_id", "ASC"],
      ["slot_role", "ASC"],
      ["container_id", "ASC"],
    ],
  });

  // Map: actorId -> [{slotRole, containerId}]
  const ownersByActorId = new Map();
  for (const r of ownerRows) {
    const o = r.get({ plain: true });
    const actorId = Number(o.owner_id);
    if (!ownersByActorId.has(actorId)) ownersByActorId.set(actorId, []);
    ownersByActorId.get(actorId).push({
      slotRole: o.slot_role,
      containerId: Number(o.container_id),
    });
  }

  // 3) containers (pega def_id para o runtime saber quantos slots existem no futuro)
  const containerIds = Array.from(
    new Set(ownerRows.map((r) => Number(r.get({ plain: true }).container_id)))
  );

  const containerRows = containerIds.length
    ? await db.GaContainer.findAll({
        where: { id: containerIds },
        attributes: ["id", "container_def_id", "state", "rev"],
        order: [["id", "ASC"]],
      })
    : [];

  const containersById = new Map();
  for (const r of containerRows) {
    const c = r.get({ plain: true });
    containersById.set(Number(c.id), {
      id: Number(c.id),
      containerDefId: Number(c.container_def_id),
      state: c.state,
      rev: Number(c.rev ?? 0),
    });
  }

  // 4) monta payload final
  const actorsById = new Map(actors.map((a) => [a.id, a]));

  for (const [actorId, links] of ownersByActorId.entries()) {
    const actor = actorsById.get(actorId);
    if (!actor) continue;

    actor.containers = links
      .map((l) => {
        const c = containersById.get(l.containerId) || null;
        return {
          slotRole: l.slotRole,
          containerId: l.containerId,
          containerDefId: c?.containerDefId ?? null,
          state: c?.state ?? null,
          rev: c?.rev ?? null,
        };
      })
      .sort((a, b) => String(a.slotRole).localeCompare(String(b.slotRole)));
  }

  return actors;
}

module.exports = {
  loadActorsForInstance,
};