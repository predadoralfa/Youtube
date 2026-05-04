"use strict";

const db = require("../models");
const { DEFAULT_LOCAL_VISUAL_VERSION, DEFAULT_GROUND_COLOR } = require("../config/worldVisualConstants");
const { getProceduralMapProfile } = require("../config/mapProceduralProfiles");
const { ensureRuntimeLoaded, getRuntime } = require("../state/runtimeStore");
const { loadActorsForInstance } = require("./actorLoader");
const { buildActorPayload } = require("./actorLoader/payload");
const { loadSceneObjectsForInstance } = require("./sceneObjectLoader");
const { buildSceneObjectPayload } = require("./sceneObjectLoader/payload");
const { createRuntimeActor } = require("./actorService");
const { createRuntimeSceneObject } = require("./sceneObjectService");
const { getWorldClockBootstrap } = require("./worldClockService");
const { addActor, updateActorPos } = require("../state/actorsRuntimeStore");
const {
  addSceneObject,
  updateSceneObjectTransform,
} = require("../state/sceneObjectsRuntimeStore");

function normalizeTransformPayload(payload = {}) {
  const pos = payload?.pos ?? payload?.position ?? {};
  const scale = payload?.scale ?? {};
  return {
    posX: Number(pos.x ?? payload?.posX ?? payload?.pos_x ?? 0),
    posY: Number(pos.y ?? payload?.posY ?? payload?.pos_y ?? 0),
    posZ: Number(pos.z ?? payload?.posZ ?? payload?.pos_z ?? 0),
    yaw: Number(payload?.yaw ?? 0),
    scaleX: Number(scale.x ?? payload?.scaleX ?? payload?.scale_x ?? 1),
    scaleY: Number(scale.y ?? payload?.scaleY ?? payload?.scale_y ?? 1),
    scaleZ: Number(scale.z ?? payload?.scaleZ ?? payload?.scale_z ?? 1),
  };
}

async function resolveEditorRuntime(userId) {
  await ensureRuntimeLoaded(userId);
  const runtime = getRuntime(String(userId)) ?? getRuntime(userId) ?? null;
  if (!runtime) {
    throw new Error("worldEditorService: runtime not found");
  }
  return runtime;
}

function resolveSpawnTransform(runtime, payload = {}) {
  const useCurrentPosition = payload?.useCurrentPosition !== false;
  const explicitPos = payload?.pos ?? payload?.position ?? null;

  if (!useCurrentPosition && explicitPos) {
    const x = Number(explicitPos.x);
    const y = Number(explicitPos.y);
    const z = Number(explicitPos.z);
    if ([x, y, z].every(Number.isFinite)) {
      return { x, y, z };
    }
  }

  return {
    x: Number(runtime?.pos?.x ?? 0),
    y: Number(runtime?.pos?.y ?? 0),
    z: Number(runtime?.pos?.z ?? 0),
  };
}

async function buildEditorBootstrap(userId) {
  const runtime = await resolveEditorRuntime(userId);
  const instanceId = Number(runtime.instanceId ?? 0);
  if (!Number.isInteger(instanceId) || instanceId <= 0) {
    throw new Error("worldEditorService: invalid runtime instance");
  }

  const instance = await db.GaInstance.findByPk(instanceId, {
    attributes: ["id", "local_id", "instance_type", "status"],
    include: [
      {
        model: db.GaLocal,
        as: "local",
        attributes: ["id", "code", "name", "local_type", "parent_id"],
        include: [
          {
            model: db.GaLocalGeometry,
            as: "geometry",
            attributes: ["size_x", "size_z"],
          },
          {
            model: db.GaLocalVisual,
            as: "visual",
            attributes: [
              "ground_material_id",
              "ground_mesh_id",
              "ground_render_material_id",
              "version",
            ],
            include: [
              {
                model: db.GaMaterial,
                as: "groundMaterial",
                attributes: ["id", "code", "name", "friction", "restitution"],
              },
              {
                model: db.GaMeshTemplate,
                as: "groundMesh",
                attributes: [
                  "id",
                  "code",
                  "mesh_kind",
                  "primitive_type",
                  "gltf_url",
                  "default_scale_x",
                  "default_scale_y",
                  "default_scale_z",
                ],
                required: false,
              },
              {
                model: db.GaRenderMaterial,
                as: "groundRenderMaterial",
                attributes: [
                  "id",
                  "code",
                  "kind",
                  "base_color",
                  "texture_url",
                  "roughness",
                  "metalness",
                ],
                required: false,
              },
            ],
          },
        ],
      },
    ],
  });
  if (!instance) {
    throw new Error("worldEditorService: instance not found");
  }

  const actors = await loadActorsForInstance(instanceId);
  const sceneObjects = await loadSceneObjectsForInstance(instanceId);
  const actorDefs = await listActorDefs();
  const objectDefs = await listSceneObjectDefs();
  const local = instance.local;
  const sizeX = Number(local?.geometry?.size_x ?? 100);
  const sizeZ = Number(local?.geometry?.size_z ?? 100);
  const visualVersion = Number.isFinite(Number(local?.visual?.version))
    ? Number(local.visual.version)
    : DEFAULT_LOCAL_VISUAL_VERSION;
  const groundMaterial = local?.visual?.groundMaterial ?? null;
  const groundMesh = local?.visual?.groundMesh ?? null;
  const groundRenderMaterial = local?.visual?.groundRenderMaterial ?? null;
  const worldClock = await getWorldClockBootstrap();

  return {
    ok: true,
    editor: {
      instanceId,
      operator: {
        userId: Number(userId),
        pos: {
          x: Number(runtime?.pos?.x ?? 0),
          y: Number(runtime?.pos?.y ?? 0),
          z: Number(runtime?.pos?.z ?? 0),
        },
        yaw: Number(runtime?.yaw ?? 0),
      },
    },
    instance: {
      id: instance.id,
      local_id: instance.local_id,
      instance_type: instance.instance_type,
      status: instance.status,
    },
    snapshot: {
      runtime: {
        user_id: Number(userId),
        instance_id: instanceId,
        pos: {
          x: Number(runtime?.pos?.x ?? 0),
          y: Number(runtime?.pos?.y ?? 0),
          z: Number(runtime?.pos?.z ?? 0),
        },
        yaw: Number(runtime?.yaw ?? 0),
      },
      actors,
      sceneObjects,
    },
    localTemplateVersion: `local:${local?.id ?? 0}:v${visualVersion}`,
    localTemplate: {
      local: {
        id: local?.id ?? null,
        code: local?.code ?? null,
        name: local?.name ?? null,
        local_type: local?.local_type ?? null,
        parent_id: local?.parent_id ?? null,
      },
      geometry: {
        size_x: sizeX,
        size_z: sizeZ,
      },
      visual: {
        ground_material: {
          id: groundMaterial?.id ?? null,
          code: groundMaterial?.code ?? "DEFAULT",
          name: groundMaterial?.name ?? "Default",
          friction: groundMaterial?.friction ?? null,
          restitution: groundMaterial?.restitution ?? null,
        },
        ground_mesh: groundMesh
          ? {
              id: groundMesh.id,
              code: groundMesh.code,
              mesh_kind: groundMesh.mesh_kind,
              primitive_type: groundMesh.primitive_type,
              gltf_url: groundMesh.gltf_url,
              default_scale: {
                x: groundMesh.default_scale_x,
                y: groundMesh.default_scale_y,
                z: groundMesh.default_scale_z,
              },
            }
          : null,
        ground_render_material: groundRenderMaterial
          ? {
              id: groundRenderMaterial.id,
              code: groundRenderMaterial.code,
              kind: groundRenderMaterial.kind,
              base_color: groundRenderMaterial.base_color,
              texture_url: groundRenderMaterial.texture_url,
              roughness: groundRenderMaterial.roughness,
              metalness: groundRenderMaterial.metalness,
            }
          : null,
        ground_color: groundRenderMaterial?.base_color ?? DEFAULT_GROUND_COLOR,
        version: visualVersion,
      },
      debug: {
        bounds: { size_x: sizeX, size_z: sizeZ },
      },
    },
    proceduralMap: getProceduralMapProfile(instance.id) ?? getProceduralMapProfile(local?.id),
    worldClock,
    catalogs: {
      actorDefs,
      objectDefs,
    },
  };
}

async function listActorDefs() {
  const rows = await db.GaActorDef.findAll({
    where: { is_active: true },
    order: [["code", "ASC"]],
  });

  return rows.map((row) => ({
    id: Number(row.id),
    code: row.code,
    name: row.name,
    actorKind: row.actor_kind,
    assetKey: row.asset_key ?? null,
    visualHint: row.visual_hint ?? null,
  }));
}

async function listSceneObjectDefs() {
  const rows = await db.GaSceneObjectDef.findAll({
    where: { is_active: true },
    order: [["code", "ASC"]],
  });

  return rows.map((row) => ({
    id: Number(row.id),
    code: row.code,
    name: row.name,
    category: row.category ?? null,
    assetKey: row.asset_key ?? null,
  }));
}

async function spawnActorForEditor(userId, payload = {}) {
  const runtime = await resolveEditorRuntime(userId);
  const instanceId = Number(runtime.instanceId ?? 0);
  const spawnPos = resolveSpawnTransform(runtime, payload);
  const transform = normalizeTransformPayload({
    ...payload,
    pos: spawnPos,
  });

  const { actor } = await createRuntimeActor({
    actorDefId: payload?.actorDefId,
    actorDefCode: payload?.actorDefCode ?? payload?.actorType,
    instanceId,
    posX: transform.posX,
    posY: transform.posY,
    posZ: transform.posZ,
    yaw: transform.yaw,
    scaleX: transform.scaleX,
    scaleY: transform.scaleY,
    scaleZ: transform.scaleZ,
    stateJson: payload?.stateJson ?? null,
    status: "ACTIVE",
    rev: 1,
  });

  const hydrated = await db.GaActorRuntime.findByPk(actor.id, {
    include: [
      { association: "actorDef", required: true },
      { association: "spawn", required: false },
    ],
  });

  const actorPayload = buildActorPayload(hydrated);
  addActor(actorPayload);
  return actorPayload;
}

async function spawnSceneObjectForEditor(userId, payload = {}) {
  const runtime = await resolveEditorRuntime(userId);
  const instanceId = Number(runtime.instanceId ?? 0);
  const spawnPos = resolveSpawnTransform(runtime, payload);
  const transform = normalizeTransformPayload({
    ...payload,
    pos: spawnPos,
  });

  const { sceneObject } = await createRuntimeSceneObject({
    sceneObjectDefId: payload?.sceneObjectDefId,
    sceneObjectDefCode: payload?.sceneObjectDefCode ?? payload?.objectDefCode ?? payload?.objectType,
    instanceId,
    posX: transform.posX,
    posY: transform.posY,
    posZ: transform.posZ,
    yaw: transform.yaw,
    scaleX: transform.scaleX,
    scaleY: transform.scaleY,
    scaleZ: transform.scaleZ,
    stateJson: payload?.stateJson ?? null,
    status: "ACTIVE",
    rev: 1,
  });

  const hydrated = await db.GaSceneObject.findByPk(sceneObject.id, {
    include: [{ association: "sceneObjectDef", required: true }],
  });

  const sceneObjectPayload = buildSceneObjectPayload(hydrated);
  addSceneObject(sceneObjectPayload);
  return sceneObjectPayload;
}

async function updateActorForEditor(userId, actorIdRaw, payload = {}) {
  const runtime = await resolveEditorRuntime(userId);
  const actorId = Number(actorIdRaw);
  if (!Number.isInteger(actorId) || actorId <= 0) {
    throw new Error("worldEditorService: invalid actorId");
  }

  const actor = await db.GaActorRuntime.findByPk(actorId, {
    include: [
      { association: "actorDef", required: true },
      { association: "spawn", required: false },
    ],
  });
  if (!actor) throw new Error("worldEditorService: actor not found");
  if (Number(actor.instance_id) !== Number(runtime.instanceId)) {
    throw new Error("worldEditorService: actor instance mismatch");
  }

  const transform = normalizeTransformPayload(payload);
  const nextRev = Number(actor.rev ?? 0) + 1;
  await actor.update({
    pos_x: transform.posX,
    pos_y: transform.posY,
    pos_z: transform.posZ,
    yaw: transform.yaw,
    scale_x: transform.scaleX,
    scale_y: transform.scaleY,
    scale_z: transform.scaleZ,
    rev: nextRev,
  });

  actor.rev = nextRev;
  updateActorPos(actor.id, { x: transform.posX, y: transform.posY, z: transform.posZ }, transform.yaw, {
    x: transform.scaleX,
    y: transform.scaleY,
    z: transform.scaleZ,
  });
  return buildActorPayload(actor);
}

async function updateSceneObjectForEditor(userId, sceneObjectIdRaw, payload = {}) {
  const runtime = await resolveEditorRuntime(userId);
  const sceneObjectId = Number(sceneObjectIdRaw);
  if (!Number.isInteger(sceneObjectId) || sceneObjectId <= 0) {
    throw new Error("worldEditorService: invalid sceneObjectId");
  }

  const sceneObject = await db.GaSceneObject.findByPk(sceneObjectId, {
    include: [{ association: "sceneObjectDef", required: true }],
  });
  if (!sceneObject) throw new Error("worldEditorService: scene object not found");
  if (Number(sceneObject.instance_id) !== Number(runtime.instanceId)) {
    throw new Error("worldEditorService: scene object instance mismatch");
  }

  const transform = normalizeTransformPayload(payload);
  const nextRev = Number(sceneObject.rev ?? 0) + 1;
  await sceneObject.update({
    pos_x: transform.posX,
    pos_y: transform.posY,
    pos_z: transform.posZ,
    yaw: transform.yaw,
    scale_x: transform.scaleX,
    scale_y: transform.scaleY,
    scale_z: transform.scaleZ,
    rev: nextRev,
  });

  sceneObject.rev = nextRev;
  updateSceneObjectTransform(
    sceneObject.id,
    { x: transform.posX, y: transform.posY, z: transform.posZ },
    transform.yaw,
    { x: transform.scaleX, y: transform.scaleY, z: transform.scaleZ }
  );
  return buildSceneObjectPayload(sceneObject);
}

async function disableActorForEditor(userId, actorIdRaw) {
  const runtime = await resolveEditorRuntime(userId);
  const actorId = Number(actorIdRaw);
  const actor = await db.GaActorRuntime.findByPk(actorId, {
    include: [
      { association: "actorDef", required: true },
      { association: "spawn", required: false },
    ],
  });
  if (!actor) throw new Error("worldEditorService: actor not found");
  if (Number(actor.instance_id) !== Number(runtime.instanceId)) {
    throw new Error("worldEditorService: actor instance mismatch");
  }
  const nextRev = Number(actor.rev ?? 0) + 1;
  await actor.update({ status: "DISABLED", rev: nextRev });
  actor.rev = nextRev;
  return buildActorPayload(actor);
}

async function disableSceneObjectForEditor(userId, sceneObjectIdRaw) {
  const runtime = await resolveEditorRuntime(userId);
  const sceneObjectId = Number(sceneObjectIdRaw);
  const sceneObject = await db.GaSceneObject.findByPk(sceneObjectId, {
    include: [{ association: "sceneObjectDef", required: true }],
  });
  if (!sceneObject) throw new Error("worldEditorService: scene object not found");
  if (Number(sceneObject.instance_id) !== Number(runtime.instanceId)) {
    throw new Error("worldEditorService: scene object instance mismatch");
  }
  const nextRev = Number(sceneObject.rev ?? 0) + 1;
  await sceneObject.update({ status: "DISABLED", rev: nextRev });
  sceneObject.rev = nextRev;
  return buildSceneObjectPayload(sceneObject);
}

module.exports = {
  buildEditorBootstrap,
  listActorDefs,
  listSceneObjectDefs,
  spawnActorForEditor,
  spawnSceneObjectForEditor,
  updateActorForEditor,
  updateSceneObjectForEditor,
  disableActorForEditor,
  disableSceneObjectForEditor,
};
