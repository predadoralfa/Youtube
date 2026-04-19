/**
 * Runtime store autoritativo para ACTORS.
 *
 * Mantem o cache em memoria das instancias de actor ja resolvidas pelo backend.
 * O contrato novo diferencia:
 * - actorDefCode: tipo estavel cadastrado em ga_actor_def
 * - actorKind: familia ampla (OBJECT, LOOT, NPC, RESOURCE_NODE...)
 * - spawnId: origem fixa do mapa quando existir
 */

const actorsById = new Map();
const actorsByInstance = new Map();

function toKey(value) {
  return String(value);
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function addActor(actor) {
  if (!actor || actor.id == null) return;

  const id = toKey(actor.id);
  const instanceId = toKey(actor.instanceId);
  const containers = (actor.containers ?? []).map((container) => ({
    slotRole: String(container.slotRole ?? ""),
    containerId: toNum(container.containerId, 0),
    containerDefId: container.containerDefId == null ? null : toNum(container.containerDefId, 0),
    state: String(container.state ?? "ACTIVE"),
    rev: toNum(container.rev, 0),
  }));

  const record = {
    id,
    actorType: actor.actorType ?? actor.actorDefCode ?? null,
    actorDefCode: actor.actorDefCode ?? actor.actorType ?? null,
    actorKind: actor.actorKind ?? null,
    displayName: actor.displayName ?? null,
    visualHint: actor.visualHint ?? null,
    spawnId: actor.spawnId == null ? null : toKey(actor.spawnId),
    instanceId,
    pos: {
      x: toNum(actor.pos?.x, 0),
      y: toNum(actor.pos?.y, 0),
      z: toNum(actor.pos?.z, 0),
    },
    status: actor.status ?? "ACTIVE",
    rev: toNum(actor.rev, 0),
    state: actor.state ?? actor.state_json ?? null,
    containers,
    lootSummary: actor.lootSummary ?? actor.loot_summary ?? null,
  };

  actorsById.set(id, record);

  let set = actorsByInstance.get(instanceId);
  if (!set) {
    set = new Set();
    actorsByInstance.set(instanceId, set);
  }
  set.add(id);
}

function updateActorPos(actorId, pos) {
  const id = toKey(actorId);
  const actor = actorsById.get(id);
  if (!actor) return false;

  actor.pos = {
    x: toNum(pos?.x, actor.pos?.x ?? 0),
    y: toNum(pos?.y, actor.pos?.y ?? 0),
    z: toNum(pos?.z, actor.pos?.z ?? 0),
  };
  actor.rev += 1;
  return true;
}

function updateActorState(actorId, nextState) {
  const id = toKey(actorId);
  const actor = actorsById.get(id);
  if (!actor) return false;

  actor.state = nextState == null ? null : nextState;
  actor.rev += 1;
  return true;
}

function removeActor(actorId) {
  const id = toKey(actorId);
  const actor = actorsById.get(id);
  if (!actor) return false;

  actorsById.delete(id);
  const set = actorsByInstance.get(actor.instanceId);
  if (set) {
    set.delete(id);
    if (set.size === 0) actorsByInstance.delete(actor.instanceId);
  }

  return true;
}

function getActor(actorId) {
  return actorsById.get(toKey(actorId)) || null;
}

function getActorContainers(actorId) {
  const actor = actorsById.get(toKey(actorId));
  return actor?.containers ?? [];
}

function getActorsForInstance(instanceId) {
  const set = actorsByInstance.get(toKey(instanceId));
  if (!set) return [];

  const out = [];
  for (const id of set) {
    const actor = actorsById.get(id);
    if (actor) out.push(actor);
  }
  return out;
}

function clearInstance(instanceId) {
  const key = toKey(instanceId);
  const set = actorsByInstance.get(key);
  if (!set) return;

  for (const id of set) actorsById.delete(id);
  actorsByInstance.delete(key);
}

module.exports = {
  addActor,
  updateActorPos,
  updateActorState,
  removeActor,
  getActor,
  getActorContainers,
  getActorsForInstance,
  clearInstance,
};
