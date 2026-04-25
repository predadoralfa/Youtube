"use strict";

const db = require("../models");
const { ensureRuntimeLoaded, getRuntime } = require("../state/runtimeStore");
const { removeActor } = require("../state/actorsRuntimeStore");
const { createRuntimeActor } = require("./actorService/runtime");
const { resolveActorDef } = require("./actorService/defs");
const { toFiniteNumber } = require("./actorService/shared");
const { awardSkillXp, loadUserSkillSummary } = require("./skillProgressionService");
const { ensureInventoryLoaded } = require("../state/inventory/loader");
const { ensureEquipmentLoaded } = require("../state/equipment/loader");
const { clearInventory } = require("../state/inventory/store");
const {
  ensurePrimitiveShelterMaterialsContainer,
  getPrimitiveShelterMaterialsSlotRole,
  countItemDefIdInContainer,
  clearPrimitiveShelterMaterialsContainer,
} = require("./buildMaterialsService");

function parseMaybeJsonObject(value) {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

const PRIMITIVE_SHELTER_CODE = "PRIMITIVE_SHELTER";
const PRIMITIVE_SHELTER_BUILD_REQUIREMENTS = [
  {
    itemCode: "GRAVETO",
    quantity: 1,
  },
];
const PRIMITIVE_SHELTER_BUILD_DURATION_MS = 180000;
const PRIMITIVE_SHELTER_BUILD_XP = 50;
const PRIMITIVE_SHELTER_BUILD_SKILL = "SKILL_BUILDING";
const PRIMITIVE_SHELTER_APPROACH_RADIUS = 1.5;
const BUILD_TIME_REDUCTION_PER_LEVEL_MS = 30000;

function buildPrimitiveShelterConfig(state = null) {
  const current = parseMaybeJsonObject(state) || {};
  const buildRequirements = Array.isArray(current.buildRequirements) && current.buildRequirements.length
    ? current.buildRequirements.map((item) => ({
        itemCode: String(item?.itemCode ?? item?.code ?? "GRAVETO").trim().toUpperCase() || "GRAVETO",
        quantity: Math.max(1, toFiniteNumber(item?.quantity ?? item?.qty ?? 1, 1)),
      }))
    : PRIMITIVE_SHELTER_BUILD_REQUIREMENTS;

  return {
    buildRequirements,
    buildDurationMs: Math.max(
      1000,
      toFiniteNumber(current.buildDurationMs ?? current.build_duration_ms, PRIMITIVE_SHELTER_BUILD_DURATION_MS)
    ),
    buildXpReward: Math.max(
      0,
      toFiniteNumber(current.buildXpReward ?? current.build_xp_reward, PRIMITIVE_SHELTER_BUILD_XP)
    ),
    buildSkillCode:
      String(current.buildSkillCode ?? current.build_skill_code ?? PRIMITIVE_SHELTER_BUILD_SKILL).trim() ||
      PRIMITIVE_SHELTER_BUILD_SKILL,
  };
}

function resolveBuildDurationMs(baseDurationMs, buildSkillLevel) {
  const base = Math.max(1000, toFiniteNumber(baseDurationMs, PRIMITIVE_SHELTER_BUILD_DURATION_MS));
  const level = Math.max(1, toFiniteNumber(buildSkillLevel, 1));
  const reductionMs = level * BUILD_TIME_REDUCTION_PER_LEVEL_MS;
  return Math.max(1000, base - reductionMs);
}

function buildPrimitiveShelterState(ownerUserId, ownerName, worldPos) {
  const config = buildPrimitiveShelterConfig();
  return {
    buildKind: PRIMITIVE_SHELTER_CODE,
    structureName: "Primitive Shelter",
    displayName: `Primitive Shelter - ${ownerName}`,
    ownerUserId,
    ownerName,
    constructionState: "PLANNED",
    constructionStartedAtMs: null,
    constructionCompletedAtMs: null,
    constructionProgressMs: 0,
    constructionDurationMs: config.buildDurationMs,
    buildRequirements: config.buildRequirements,
    buildSkillCode: config.buildSkillCode,
    buildXpReward: config.buildXpReward,
    buildMaterialsSlotRole: null,
    buildMaterialsContainerId: null,
    buildMaterialsSlotCount: 0,
    canCancel: true,
    canBuild: true,
    footprint: {
      width: 2.6,
      height: 1.5,
    },
    placedAt: new Date().toISOString(),
    placedWorldPos: worldPos ? { x: Number(worldPos.x ?? 0), z: Number(worldPos.z ?? 0) } : null,
  };
}

function countRequirementQtyInBuildContainer(invRt, slotRole, itemDefId) {
  return countItemDefIdInContainer(invRt, slotRole, itemDefId);
}

function resolvePrimitiveShelterDistance(posA, posB) {
  const ax = toFiniteNumber(posA?.x, NaN);
  const az = toFiniteNumber(posA?.z, NaN);
  const bx = toFiniteNumber(posB?.x, NaN);
  const bz = toFiniteNumber(posB?.z, NaN);
  if (![ax, az, bx, bz].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const dx = ax - bx;
  const dz = az - bz;
  return Math.hypot(dx, dz);
}

function resolveConstructionProgress(state, nowMs = Date.now()) {
  const config = buildPrimitiveShelterConfig(state);
  const constructionState = String(state?.constructionState ?? "PLANNED").trim().toUpperCase() || "PLANNED";
  const startedAtMs = toFiniteNumber(state?.constructionStartedAtMs ?? state?.construction_started_at_ms, 0);
  const durationMs = toFiniteNumber(state?.constructionDurationMs ?? state?.construction_duration_ms, config.buildDurationMs);
  const completedAtMs = toFiniteNumber(state?.constructionCompletedAtMs ?? state?.construction_completed_at_ms, 0);

  if (constructionState !== "RUNNING") {
    return {
      constructionState,
      durationMs,
      progressMs: toFiniteNumber(state?.constructionProgressMs ?? state?.construction_progress_ms, 0),
      progressRatio: durationMs > 0 ? Math.max(0, Math.min(1, toFiniteNumber(state?.constructionProgressMs ?? state?.construction_progress_ms, 0) / durationMs)) : 0,
      startedAtMs: Number.isFinite(startedAtMs) && startedAtMs > 0 ? startedAtMs : null,
      completedAtMs: Number.isFinite(completedAtMs) && completedAtMs > 0 ? completedAtMs : null,
      isRunning: false,
      isPlanned: constructionState === "PLANNED",
      isCompleted: constructionState === "COMPLETED",
    };
  }

  const safeStartedAtMs = Number.isFinite(startedAtMs) ? startedAtMs : 0;
  const safeDurationMs = Math.max(1000, Number.isFinite(durationMs) ? durationMs : config.buildDurationMs);
  const progressMs = Math.max(0, Math.min(safeDurationMs, nowMs - safeStartedAtMs));
  return {
    constructionState,
    durationMs: safeDurationMs,
    progressMs,
    progressRatio: safeDurationMs > 0 ? Math.max(0, Math.min(1, progressMs / safeDurationMs)) : 0,
    startedAtMs: safeStartedAtMs > 0 ? safeStartedAtMs : null,
    completedAtMs: Number.isFinite(completedAtMs) && completedAtMs > 0 ? completedAtMs : null,
    isRunning: true,
    isPlanned: false,
    isCompleted: false,
  };
}

async function persistActorState(actor, nextState, tx) {
  const nextRev = Number(actor.rev ?? 0) + 1;
  await actor.update(
    {
      state_json: nextState,
      rev: nextRev,
    },
    { transaction: tx }
  );
  actor.state_json = nextState;
  actor.rev = nextRev;
  return nextRev;
}

function buildActorPayload(actor, actorDef, spawn, state) {
  const displayName =
    state?.displayName ??
    state?.structureName ??
    actorDef?.name ??
    actorDef?.code ??
    `Actor ${actor.id}`;

  return {
    id: String(actor.id),
    actorType: actorDef?.code ?? null,
    actorDefCode: actorDef?.code ?? null,
    actorKind: actorDef?.actor_kind ?? null,
    displayName,
    assetKey: actorDef?.asset_key ?? null,
    instanceId: Number(actor.instance_id),
    spawnId: actor.actor_spawn_id == null ? null : Number(actor.actor_spawn_id),
    pos: {
      x: toFiniteNumber(actor.pos_x, 0),
      y: toFiniteNumber(actor.pos_y, 0),
      z: toFiniteNumber(actor.pos_z, 0),
    },
    status: actor.status,
    rev: Number(actor.rev ?? 0),
    visualHint: actorDef?.visual_hint ?? null,
    state,
    containers: [],
    lootSummary: null,
  };
}

async function findActiveBuildActor(userId, instanceId, tx) {
  const [rows] = await db.sequelize.query(
    `
    SELECT a.id
    FROM ga_actor_runtime a
    INNER JOIN ga_actor_def ad ON ad.id = a.actor_def_id
    WHERE ad.code = 'PRIMITIVE_SHELTER'
      AND a.instance_id = :instanceId
      AND a.status = 'ACTIVE'
      AND CAST(JSON_UNQUOTE(JSON_EXTRACT(a.state_json, '$.ownerUserId')) AS UNSIGNED) = :userId
    LIMIT 1
    `,
    {
      transaction: tx,
      replacements: {
        userId: Number(userId),
        instanceId: Number(instanceId),
      },
    }
  );

  return Number(rows?.[0]?.id ?? 0) || null;
}

async function resolveOwnerName(userId, tx) {
  const profile = await db.GaUserProfile.findOne({
    where: { user_id: Number(userId) },
    transaction: tx,
    lock: tx?.LOCK?.SHARE,
  });

  if (profile?.display_name) {
    return String(profile.display_name).trim();
  }

  const user = await db.GaUser.findByPk(Number(userId), {
    transaction: tx,
    lock: tx?.LOCK?.SHARE,
  });

  if (user?.email) {
    return String(user.email).split("@")[0];
  }

  return `User ${Number(userId)}`;
}

async function placePrimitiveShelter({ userId, instanceId, worldPos, tx }) {
  const ownerUserId = Number(userId);
  const runtimeInstanceId = Number(instanceId);
  const x = toFiniteNumber(worldPos?.x, NaN);
  const z = toFiniteNumber(worldPos?.z, NaN);

  if (!Number.isInteger(ownerUserId) || ownerUserId <= 0) {
    return { ok: false, code: "INVALID_USER_ID", message: "Invalid user id" };
  }

  if (!Number.isInteger(runtimeInstanceId) || runtimeInstanceId <= 0) {
    return { ok: false, code: "INVALID_INSTANCE_ID", message: "Invalid instance id" };
  }

  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return { ok: false, code: "INVALID_BUILD_POS", message: "Invalid build position" };
  }

  const existingActorId = await findActiveBuildActor(ownerUserId, runtimeInstanceId, tx);
  if (existingActorId) {
    return {
      ok: false,
      code: "BUILD_ALREADY_ACTIVE",
      message: "You already have an active Primitive Shelter project.",
    };
  }

  const actorDef = await resolveActorDef({ actorDefCode: "PRIMITIVE_SHELTER" }, tx);
  const ownerName = await resolveOwnerName(ownerUserId, tx);

  const state = buildPrimitiveShelterState(ownerUserId, ownerName, { x, z });

  const spawn = await db.GaActorSpawn.create(
    {
      instance_id: runtimeInstanceId,
      actor_def_id: Number(actorDef.id),
      pos_x: x,
      pos_y: 0,
      pos_z: z,
      state_override_json: state,
      is_active: true,
      rev: 1,
    },
    { transaction: tx }
  );

  const created = await createRuntimeActor({
    actorDefId: Number(actorDef.id),
    actorSpawnId: Number(spawn.id),
    instanceId: runtimeInstanceId,
    posX: x,
    posY: 0,
    posZ: z,
    stateJson: state,
    status: "ACTIVE",
    rev: 1,
    transaction: tx,
  });

  const materialsContainer = await ensurePrimitiveShelterMaterialsContainer({
    userId: ownerUserId,
    actorId: Number(created.actor.id),
    slotCount: state.buildRequirements.length || 1,
    tx,
  });

  const nextState = {
    ...state,
    buildMaterialsSlotRole: materialsContainer.slotRole,
    buildMaterialsContainerId: materialsContainer.container?.id != null ? Number(materialsContainer.container.id) : null,
    buildMaterialsSlotCount: materialsContainer.slotCount,
  };
  await persistActorState(created.actor, nextState, tx);

  const actorPayload = buildActorPayload(created.actor, actorDef, spawn, nextState);

  return {
    ok: true,
    actorPayload,
    spawnId: Number(spawn.id),
    actorId: Number(created.actor.id),
  };
}

async function startPrimitiveShelterConstruction({ userId, actorId, tx, inventoryRuntime, equipmentRuntime }) {
  const ownerUserId = Number(userId);
  const runtimeActorId = Number(actorId);

  if (!Number.isInteger(ownerUserId) || ownerUserId <= 0) {
    return { ok: false, code: "INVALID_USER_ID", message: "Invalid user id" };
  }

  if (!Number.isInteger(runtimeActorId) || runtimeActorId <= 0) {
    return { ok: false, code: "INVALID_ACTOR_ID", message: "Invalid actor id" };
  }

  const actor = await db.GaActorRuntime.findByPk(runtimeActorId, {
    include: [
      {
        association: "actorDef",
        required: true,
      },
      {
        association: "spawn",
        required: false,
      },
    ],
    transaction: tx,
    lock: tx?.LOCK?.UPDATE,
  });

  if (!actor) {
    return { ok: false, code: "ACTOR_NOT_FOUND", message: "Build actor not found" };
  }

  if (String(actor.actorDef?.code ?? "").toUpperCase() !== PRIMITIVE_SHELTER_CODE) {
    return { ok: false, code: "INVALID_BUILD_TYPE", message: "This actor is not a Primitive Shelter" };
  }

  const state = parseMaybeJsonObject(actor.state_json) || {};
  const actorOwnerId = Number(state?.ownerUserId ?? state?.owner_user_id ?? NaN);
  if (!Number.isFinite(actorOwnerId) || actorOwnerId !== ownerUserId) {
    return { ok: false, code: "NOT_OWNER", message: "You do not own this construction" };
  }

  const constructionState = String(state?.constructionState ?? state?.construction_state ?? "PLANNED")
    .trim()
    .toUpperCase();
  if (constructionState !== "PLANNED") {
    return {
      ok: false,
      code: "BUILD_NOT_PLANNED",
      message: "This project is already running or completed.",
    };
  }

  const buildConfig = buildPrimitiveShelterConfig(state);
  const requirements = Array.isArray(buildConfig.buildRequirements) ? buildConfig.buildRequirements : [];
  const inventoryRt = inventoryRuntime ?? (await ensureInventoryLoaded(ownerUserId));
  const equipmentRt = equipmentRuntime ?? (await ensureEquipmentLoaded(ownerUserId));
  void equipmentRt;
  const buildSkillSummary = await loadUserSkillSummary(ownerUserId, buildConfig.buildSkillCode, tx);
  const buildSkillLevel = Math.max(1, Number(buildSkillSummary?.currentLevel ?? 1));

  const buildMaterialsSlotRole =
    String(state?.buildMaterialsSlotRole ?? state?.build_materials_slot_role ?? getPrimitiveShelterMaterialsSlotRole(runtimeActorId)).trim() ||
    getPrimitiveShelterMaterialsSlotRole(runtimeActorId);
  const buildMaterialsContainer = inventoryRt.containersByRole?.get(buildMaterialsSlotRole) ?? null;
  if (!buildMaterialsContainer) {
    return {
      ok: false,
      code: "BUILD_MATERIALS_CONTAINER_MISSING",
      message: "The build materials container is missing. Reopen the shelter card to refresh it.",
    };
  }

  for (const requirement of requirements) {
    const itemCode = String(requirement?.itemCode ?? requirement?.code ?? "").trim().toUpperCase();
    const quantity = Math.max(1, Number(requirement?.quantity ?? requirement?.qty ?? 1));
    if (!itemCode) {
      return { ok: false, code: "BUILD_INVALID_REQUIREMENT", message: "Invalid build requirement." };
    }

    const itemDef = await db.GaItemDef.findOne({
      where: { code: itemCode },
      transaction: tx,
      lock: tx?.LOCK?.SHARE,
    });
    if (!itemDef) {
      return {
        ok: false,
        code: "BUILD_REQUIREMENT_MISSING_DEF",
        message: `Required item not found: ${itemCode}`,
      };
    }

    const haveQty = countRequirementQtyInBuildContainer(inventoryRt, buildMaterialsSlotRole, Number(itemDef.id));
    if (haveQty < quantity) {
      return {
        ok: false,
        code: "BUILD_MISSING_MATERIALS",
        message: "Deposit all required materials before starting construction.",
      };
    }
  }

  const startedAtMs = Date.now();
  const nextState = {
    ...state,
    constructionState: "RUNNING",
    constructionStartedAtMs: startedAtMs,
    constructionCompletedAtMs: null,
    constructionProgressMs: 0,
    constructionDurationMs: resolveBuildDurationMs(buildConfig.buildDurationMs, buildSkillLevel),
    buildRequirements: requirements.length ? requirements : buildConfig.buildRequirements,
    buildSkillCode: buildConfig.buildSkillCode,
    buildXpReward: buildConfig.buildXpReward,
    buildMaterialsSlotRole,
    canCancel: false,
    canBuild: false,
  };

  const nextRev = await persistActorState(actor, nextState, tx);

  await awardSkillXp(
    ownerUserId,
    buildConfig.buildSkillCode,
    buildConfig.buildXpReward,
    tx
  );

  const actorPayload = buildActorPayload(
    actor,
    actor.actorDef,
    actor.spawn ?? null,
    nextState
  );

  return {
    ok: true,
    actorId: runtimeActorId,
    instanceId: Number(actor.instance_id),
    actorPayload,
    rev: nextRev,
  };
}

async function pausePrimitiveShelterConstruction({ userId, actorId, tx }) {
  const ownerUserId = Number(userId);
  const runtimeActorId = Number(actorId);

  if (!Number.isInteger(ownerUserId) || ownerUserId <= 0) {
    return { ok: false, code: "INVALID_USER_ID", message: "Invalid user id" };
  }

  if (!Number.isInteger(runtimeActorId) || runtimeActorId <= 0) {
    return { ok: false, code: "INVALID_ACTOR_ID", message: "Invalid actor id" };
  }

  const actor = await db.GaActorRuntime.findByPk(runtimeActorId, {
    include: [
      {
        association: "actorDef",
        required: true,
      },
    ],
    transaction: tx,
    lock: tx?.LOCK?.UPDATE,
  });

  if (!actor) {
    return { ok: false, code: "ACTOR_NOT_FOUND", message: "Build actor not found" };
  }

  if (String(actor.actorDef?.code ?? "").toUpperCase() !== PRIMITIVE_SHELTER_CODE) {
    return { ok: false, code: "INVALID_BUILD_TYPE", message: "This actor is not a Primitive Shelter" };
  }

  const state = parseMaybeJsonObject(actor.state_json) || {};
  const actorOwnerId = Number(state?.ownerUserId ?? state?.owner_user_id ?? NaN);
  if (!Number.isFinite(actorOwnerId) || actorOwnerId !== ownerUserId) {
    return { ok: false, code: "NOT_OWNER", message: "You do not own this construction" };
  }

  const constructionState = String(state?.constructionState ?? state?.construction_state ?? "PLANNED")
    .trim()
    .toUpperCase();
  if (constructionState !== "RUNNING") {
    return {
      ok: false,
      code: "BUILD_NOT_RUNNING",
      message: "Only running constructions can be paused.",
    };
  }

  const progress = resolveConstructionProgress(state, Date.now());
  const nextState = {
    ...state,
    constructionState: "PAUSED",
    constructionStartedAtMs: null,
    constructionCompletedAtMs: null,
    constructionProgressMs: progress.progressMs,
    constructionDurationMs: progress.durationMs,
    canCancel: true,
    canBuild: false,
  };

  const nextRev = await persistActorState(actor, nextState, tx);
  const actorPayload = buildActorPayload(actor, actor.actorDef, actor.spawn ?? null, nextState);

  return {
    ok: true,
    actorId: runtimeActorId,
    instanceId: Number(actor.instance_id),
    actorPayload,
    rev: nextRev,
  };
}

async function resumePrimitiveShelterConstruction({ userId, actorId, tx, currentPos = null }) {
  const ownerUserId = Number(userId);
  const runtimeActorId = Number(actorId);

  if (!Number.isInteger(ownerUserId) || ownerUserId <= 0) {
    return { ok: false, code: "INVALID_USER_ID", message: "Invalid user id" };
  }

  if (!Number.isInteger(runtimeActorId) || runtimeActorId <= 0) {
    return { ok: false, code: "INVALID_ACTOR_ID", message: "Invalid actor id" };
  }

  const actor = await db.GaActorRuntime.findByPk(runtimeActorId, {
    include: [
      {
        association: "actorDef",
        required: true,
      },
    ],
    transaction: tx,
    lock: tx?.LOCK?.UPDATE,
  });

  if (!actor) {
    return { ok: false, code: "ACTOR_NOT_FOUND", message: "Build actor not found" };
  }

  if (String(actor.actorDef?.code ?? "").toUpperCase() !== PRIMITIVE_SHELTER_CODE) {
    return { ok: false, code: "INVALID_BUILD_TYPE", message: "This actor is not a Primitive Shelter" };
  }

  const state = parseMaybeJsonObject(actor.state_json) || {};
  const actorOwnerId = Number(state?.ownerUserId ?? state?.owner_user_id ?? NaN);
  if (!Number.isFinite(actorOwnerId) || actorOwnerId !== ownerUserId) {
    return { ok: false, code: "NOT_OWNER", message: "You do not own this construction" };
  }

  const constructionState = String(state?.constructionState ?? state?.construction_state ?? "PLANNED")
    .trim()
    .toUpperCase();
  if (constructionState !== "PAUSED") {
    return {
      ok: false,
      code: "BUILD_NOT_PAUSED",
      message: "Only paused constructions can be resumed.",
    };
  }

  const distance = resolvePrimitiveShelterDistance(currentPos ?? null, {
    x: actor.pos_x,
    z: actor.pos_z,
  });
  if (distance > PRIMITIVE_SHELTER_APPROACH_RADIUS) {
    return {
      ok: false,
      code: "BUILD_TOO_FAR",
      message: "Move inside the marked area to resume construction.",
    };
  }

  const progress = resolveConstructionProgress(state, Date.now());
  const startedAtMs = Date.now() - Math.max(0, progress.progressMs);
  const nextState = {
    ...state,
    constructionState: "RUNNING",
    constructionStartedAtMs: startedAtMs,
    constructionCompletedAtMs: null,
    constructionProgressMs: progress.progressMs,
    constructionDurationMs: progress.durationMs,
    canCancel: false,
    canBuild: false,
  };

  const nextRev = await persistActorState(actor, nextState, tx);
  const actorPayload = buildActorPayload(actor, actor.actorDef, actor.spawn ?? null, nextState);

  return {
    ok: true,
    actorId: runtimeActorId,
    instanceId: Number(actor.instance_id),
    actorPayload,
    rev: nextRev,
  };
}

async function cancelPrimitiveShelter({ userId, actorId, tx }) {
  const ownerUserId = Number(userId);
  const runtimeActorId = Number(actorId);

  console.log("[BUILD][SERVICE] cancelPrimitiveShelter:start", {
    userId: ownerUserId,
    actorId: runtimeActorId,
  });

  if (!Number.isInteger(ownerUserId) || ownerUserId <= 0) {
    return { ok: false, code: "INVALID_USER_ID", message: "Invalid user id" };
  }

  if (!Number.isInteger(runtimeActorId) || runtimeActorId <= 0) {
    return { ok: false, code: "INVALID_ACTOR_ID", message: "Invalid actor id" };
  }

  const actor = await db.GaActorRuntime.findByPk(runtimeActorId, {
    include: [
      {
        association: "actorDef",
        required: true,
      },
    ],
    transaction: tx,
    lock: tx?.LOCK?.UPDATE,
  });

  if (!actor) {
    console.log("[BUILD][SERVICE] cancelPrimitiveShelter:not_found", {
      userId: ownerUserId,
      actorId: runtimeActorId,
    });
    return { ok: false, code: "ACTOR_NOT_FOUND", message: "Build actor not found" };
  }

  if (String(actor.actorDef?.code ?? "").toUpperCase() !== "PRIMITIVE_SHELTER") {
    return { ok: false, code: "INVALID_BUILD_TYPE", message: "This actor is not a Primitive Shelter" };
  }

  const state = parseMaybeJsonObject(actor.state_json) || {};
  const actorOwnerId = Number(state?.ownerUserId ?? state?.owner_user_id ?? NaN);
  if (!Number.isFinite(actorOwnerId) || actorOwnerId !== ownerUserId) {
    console.log("[BUILD][SERVICE] cancelPrimitiveShelter:not_owner", {
      userId: ownerUserId,
      actorId: runtimeActorId,
      actorOwnerId,
    });
    return { ok: false, code: "NOT_OWNER", message: "You do not own this construction" };
  }

  const constructionState = String(state?.constructionState ?? state?.construction_state ?? "PLANNED")
    .trim()
    .toUpperCase();
  if (
    constructionState !== "PLANNED" &&
    constructionState !== "RUNNING" &&
    constructionState !== "PAUSED" &&
    constructionState !== "COMPLETED"
  ) {
    console.log("[BUILD][SERVICE] cancelPrimitiveShelter:not_cancelable", {
      userId: ownerUserId,
      actorId: runtimeActorId,
      constructionState,
    });
    return {
      ok: false,
      code: "BUILD_NOT_CANCELABLE",
      message: "Only planned, paused, running or completed constructions can be cancelled.",
    };
  }

  clearInventory(ownerUserId);
  const invRt = await ensureInventoryLoaded(ownerUserId);
  const eqRt = await ensureEquipmentLoaded(ownerUserId);
  let droppedActors = [];
  try {
    const clearResult = await clearPrimitiveShelterMaterialsContainer({
      userId: ownerUserId,
      actorId: runtimeActorId,
      invRt,
      eqRt,
      tx,
    });
    droppedActors = Array.isArray(clearResult?.droppedActors) ? clearResult.droppedActors : [];
  } catch (error) {
    console.warn("[BUILD][SERVICE] cancelPrimitiveShelter:materials_cleanup_failed", {
      userId: ownerUserId,
      actorId: runtimeActorId,
      message: error?.message ?? String(error),
    });
  }

  const spawnId = actor.actor_spawn_id == null ? null : Number(actor.actor_spawn_id);

  if (spawnId) {
    console.log("[BUILD][SERVICE] cancelPrimitiveShelter:destroy_spawn", {
      userId: ownerUserId,
      actorId: runtimeActorId,
      spawnId,
    });
    await db.GaActorSpawn.destroy({
      where: { id: spawnId },
      transaction: tx,
    });
  }

  console.log("[BUILD][SERVICE] cancelPrimitiveShelter:destroy_actor", {
    userId: ownerUserId,
    actorId: runtimeActorId,
    instanceId: Number(actor.instance_id),
  });
  await db.GaActorRuntime.destroy({
    where: { id: runtimeActorId },
    transaction: tx,
  });

  console.log("[BUILD][SERVICE] cancelPrimitiveShelter:done", {
    userId: ownerUserId,
    actorId: runtimeActorId,
    instanceId: Number(actor.instance_id),
  });

  return {
    ok: true,
    actorId: runtimeActorId,
    instanceId: Number(actor.instance_id),
    droppedActors,
  };
}

module.exports = {
  placePrimitiveShelter,
  startPrimitiveShelterConstruction,
  cancelPrimitiveShelter,
  pausePrimitiveShelterConstruction,
  resumePrimitiveShelterConstruction,
  buildPrimitiveShelterConfig,
  buildPrimitiveShelterState,
  resolvePrimitiveShelterDistance,
  PRIMITIVE_SHELTER_APPROACH_RADIUS,
  resolveConstructionProgress,
};
