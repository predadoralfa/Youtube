// server/state/actorsRuntimeStore.js

/**
 * Runtime store autoritativo para ACTORS.
 *
 * Regras:
 * - NÃO acessa banco.
 * - NÃO importa loader/serviço.
 * - NÃO depende de socket.
 * - Apenas cache em memória para consulta rápida (ex: interact).
 *
 * Fonte da verdade de carga:
 * - worldService.bootstrap (carrega via service/actorLoader e chama addActor)
 *
 * Evolução:
 * - Quando houver spawn/despawn/move de actor, atualize aqui via API.
 */

const actorsById = new Map(); // actorId(string) -> { id, instanceId, pos:{x,y,z}, status }
const actorsByInstance = new Map(); // instanceId(string) -> Set(actorId)

function toKey(v) {
  return String(v);
}

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function addActor(actor) {
  if (!actor || actor.id == null) return;

  const id = toKey(actor.id);
  const instanceId = toKey(actor.instanceId);

  const record = {
    id,
    instanceId,
    pos: {
      x: toNum(actor.pos?.x, 0),
      y: toNum(actor.pos?.y, 0),
      z: toNum(actor.pos?.z, 0),
    },
    status: actor.status ?? "ACTIVE",
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

function getActorsForInstance(instanceId) {
  const set = actorsByInstance.get(toKey(instanceId));
  if (!set) return [];

  const out = [];
  for (const id of set) {
    const a = actorsById.get(id);
    if (a) out.push(a);
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
  removeActor,
  getActor,
  getActorsForInstance,
  clearInstance,
};