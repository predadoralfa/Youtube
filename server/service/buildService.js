"use strict";

const db = require("../models");
const { ensureRuntimeLoaded, getRuntime } = require("../state/runtimeStore");
const { removeActor } = require("../state/actorsRuntimeStore");
const { createRuntimeActor } = require("./actorService/runtime");
const { resolveActorDef } = require("./actorService/defs");
const { toFiniteNumber } = require("./actorService/shared");
const { awardSkillXp } = require("./skillProgressionService");
const { ensureInventoryLoaded } = require("../state/inventory/loader");
const { ensureEquipmentLoaded } = require("../state/equipment/loader");
const { markDirty } = require("../state/inventory/store");

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

function findHandIngredientSlots(invRt, itemDefId, quantity) {
  let remaining = Number(quantity);
  const matches = [];

  for (const container of invRt.containers ?? []) {
    const slotRole = String(container?.slotRole ?? "");
    if (slotRole !== "HAND_L" && slotRole !== "HAND_R") continue;

    for (const slot of container.slots ?? []) {
      if (remaining <= 0) break;
      if (slot.itemInstanceId == null || Number(slot.qty ?? 0) <= 0) continue;

      const instance = invRt.itemInstanceById?.get(String(slot.itemInstanceId)) ?? null;
      const instanceItemDefId = instance?.itemDefId ?? instance?.item_def_id ?? null;
      if (!instance || Number(instanceItemDefId) !== Number(itemDefId)) continue;

      const take = Math.min(remaining, Number(slot.qty ?? 0));
      matches.push({ container, slot, take });
      remaining -= take;
    }
  }

  if (remaining > 0) {
    const err = new Error("Put a Graveto in HAND_L or HAND_R first.");
    err.code = "BUILD_MISSING_INGREDIENTS";
    throw err;
  }

  return matches;
}

async function persistSlot(tx, container, slotIndex, slot) {
  await db.GaContainerSlot.upsert(
    {
      container_id: Number(container.id),
      slot_index: Number(slotIndex),
      item_instance_id: slot.itemInstanceId == null ? null : Number(slot.itemInstanceId),
      qty: slot.itemInstanceId == null ? 0 : Number(slot.qty ?? 0),
    },
    { transaction: tx }
  );
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

  const actorPayload = buildActorPayload(created.actor, actorDef, spawn, state);

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

  const ingredientSpends = [];
  const touchedContainers = new Set();
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

    ingredientSpends.push({
      itemDef,
      quantity,
      matches: findHandIngredientSlots(inventoryRt, Number(itemDef.id), quantity),
    });
  }

  for (const spend of ingredientSpends) {
    for (const match of spend.matches) {
      const slotIndex = match.container.slots.indexOf(match.slot);
      match.slot.qty = Number(match.slot.qty ?? 0) - match.take;
      if (match.slot.qty <= 0) {
        if (match.slot.itemInstanceId != null) {
          inventoryRt.itemInstanceById?.delete(String(match.slot.itemInstanceId));
        }
        match.slot.itemInstanceId = null;
        match.slot.qty = 0;
      }
      await persistSlot(tx, match.container, slotIndex, match.slot);
      const container = inventoryRt.containersById?.get(String(match.container.id)) ?? null;
      if (container) container.rev = Number(container.rev ?? 0) + 1;
      touchedContainers.add(String(match.container.id));
      markDirty(ownerUserId, match.container.id);
    }
  }

  if (touchedContainers.size > 0) {
    await db.GaContainer.update(
      { rev: db.Sequelize.literal("rev + 1") },
      {
        where: {
          id: Array.from(touchedContainers),
        },
        transaction: tx,
      }
    );
  }

  const startedAtMs = Date.now();
  const nextState = {
    ...state,
    constructionState: "RUNNING",
    constructionStartedAtMs: startedAtMs,
    constructionCompletedAtMs: null,
    constructionProgressMs: 0,
    constructionDurationMs: buildConfig.buildDurationMs,
    buildRequirements: requirements.length ? requirements : buildConfig.buildRequirements,
    buildSkillCode: buildConfig.buildSkillCode,
    buildXpReward: buildConfig.buildXpReward,
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

async function resumePrimitiveShelterConstruction({ userId, actorId, tx }) {
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

  if (String(actor.actorDef?.code ?? "").toUpperCase() !== "PRIMITIVE_SHELTER") {
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
  if (constructionState !== "PLANNED" && constructionState !== "RUNNING" && constructionState !== "PAUSED") {
    return {
      ok: false,
      code: "BUILD_NOT_CANCELABLE",
      message: "Only planned, paused or running constructions can be cancelled.",
    };
  }

  const spawnId = actor.actor_spawn_id == null ? null : Number(actor.actor_spawn_id);

  if (spawnId) {
    await db.GaActorSpawn.destroy({
      where: { id: spawnId },
      transaction: tx,
    });
  }

  await db.GaActorRuntime.destroy({
    where: { id: runtimeActorId },
    transaction: tx,
  });

  return {
    ok: true,
    actorId: runtimeActorId,
    instanceId: Number(actor.instance_id),
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
