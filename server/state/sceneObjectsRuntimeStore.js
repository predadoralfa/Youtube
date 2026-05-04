/**
 * Runtime store autoritativo para SCENE OBJECTS.
 *
 * Mantem o cache em memoria das instancias de cenario resolvidas pelo backend.
 * Nao carrega regras de gameplay; apenas dados visuais/estruturais da cena.
 */

const sceneObjectsById = new Map();
const sceneObjectsByInstance = new Map();

function toKey(value) {
  return String(value);
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function addSceneObject(sceneObject) {
  if (!sceneObject || sceneObject.id == null) return;

  const id = toKey(sceneObject.id);
  const instanceId = toKey(sceneObject.instanceId);

  const record = {
    id,
    objectType: sceneObject.objectType ?? sceneObject.objectDefCode ?? null,
    objectDefCode: sceneObject.objectDefCode ?? sceneObject.objectType ?? null,
    displayName: sceneObject.displayName ?? null,
    assetKey: sceneObject.assetKey ?? null,
    category: sceneObject.category ?? null,
    instanceId,
    pos: {
      x: toNum(sceneObject.pos?.x, 0),
      y: toNum(sceneObject.pos?.y, 0),
      z: toNum(sceneObject.pos?.z, 0),
    },
    yaw: toNum(sceneObject.yaw, 0),
    scale: {
      x: toNum(sceneObject.scale?.x, 1),
      y: toNum(sceneObject.scale?.y, 1),
      z: toNum(sceneObject.scale?.z, 1),
    },
    status: sceneObject.status ?? "ACTIVE",
    rev: toNum(sceneObject.rev, 0),
    state: sceneObject.state ?? sceneObject.state_json ?? null,
  };

  sceneObjectsById.set(id, record);

  let set = sceneObjectsByInstance.get(instanceId);
  if (!set) {
    set = new Set();
    sceneObjectsByInstance.set(instanceId, set);
  }
  set.add(id);
}

function updateSceneObjectTransform(sceneObjectId, pos, yaw = null, scale = null) {
  const id = toKey(sceneObjectId);
  const sceneObject = sceneObjectsById.get(id);
  if (!sceneObject) return false;

  sceneObject.pos = {
    x: toNum(pos?.x, sceneObject.pos?.x ?? 0),
    y: toNum(pos?.y, sceneObject.pos?.y ?? 0),
    z: toNum(pos?.z, sceneObject.pos?.z ?? 0),
  };

  if (Number.isFinite(Number(yaw))) {
    sceneObject.yaw = toNum(yaw, sceneObject.yaw ?? 0);
  }

  if (scale && typeof scale === "object") {
    sceneObject.scale = {
      x: toNum(scale?.x, sceneObject.scale?.x ?? 1),
      y: toNum(scale?.y, sceneObject.scale?.y ?? 1),
      z: toNum(scale?.z, sceneObject.scale?.z ?? 1),
    };
  }

  return true;
}

function updateSceneObjectState(sceneObjectId, nextState) {
  const id = toKey(sceneObjectId);
  const sceneObject = sceneObjectsById.get(id);
  if (!sceneObject) return false;

  sceneObject.state = nextState == null ? null : nextState;
  sceneObject.rev += 1;
  return true;
}

function removeSceneObject(sceneObjectId) {
  const id = toKey(sceneObjectId);
  const sceneObject = sceneObjectsById.get(id);
  if (!sceneObject) return false;

  sceneObjectsById.delete(id);
  const set = sceneObjectsByInstance.get(sceneObject.instanceId);
  if (set) {
    set.delete(id);
    if (set.size === 0) sceneObjectsByInstance.delete(sceneObject.instanceId);
  }

  return true;
}

function getSceneObject(sceneObjectId) {
  return sceneObjectsById.get(toKey(sceneObjectId)) || null;
}

function getSceneObjectsForInstance(instanceId) {
  const set = sceneObjectsByInstance.get(toKey(instanceId));
  if (!set) return [];

  const out = [];
  for (const id of set) {
    const sceneObject = sceneObjectsById.get(id);
    if (sceneObject) out.push(sceneObject);
  }
  return out;
}

function clearInstance(instanceId) {
  const key = toKey(instanceId);
  const set = sceneObjectsByInstance.get(key);
  if (!set) return;

  for (const id of set) sceneObjectsById.delete(id);
  sceneObjectsByInstance.delete(key);
}

module.exports = {
  addSceneObject,
  updateSceneObjectTransform,
  updateSceneObjectState,
  removeSceneObject,
  getSceneObject,
  getSceneObjectsForInstance,
  clearInstance,
};
