"use strict";

const db = require("../models");
const { buildActorPayload } = require("./actorLoader/payload");
const { updateActorState } = require("../state/actorsRuntimeStore");
const { getRuntime, markRuntimeDirty } = require("../state/runtimeStore");
const { bumpRev } = require("../state/movement/entity");
const { emitPlayerState } = require("../state/movement/tickOnce/playerMovementPhase/emitPlayerState");
const { awardSkillXp } = require("./skillProgressionService");
const { buildPrimitiveShelterConfig, resolveConstructionProgress } = require("./buildService");
const { getActiveSocket } = require("../socket/sessionIndex");
const { ensureInventoryLoaded } = require("../state/inventory/loader");
const { ensureEquipmentLoaded } = require("../state/equipment/loader");
const { buildInventoryFull } = require("../state/inventory/fullPayload");
const { consumePrimitiveShelterMaterialsContainer } = require("./buildMaterialsService");
const { clearInventory } = require("../state/inventory/store");
const completingShelters = new Set();

function parseMaybeJsonObject(value) {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function completeDuePrimitiveSheltersForInstance(instanceIdRaw, nowMs = Date.now(), io = null) {
  const instanceId = Number(instanceIdRaw);
  if (!Number.isInteger(instanceId) || instanceId <= 0) return [];

  const completedActors = [];

  await db.sequelize.transaction(async (tx) => {
    const actors = await db.GaActorRuntime.findAll({
      where: {
        instance_id: instanceId,
        status: "ACTIVE",
      },
      include: [
        {
          association: "actorDef",
          required: true,
          where: { code: "PRIMITIVE_SHELTER" },
        },
        {
          association: "spawn",
          required: false,
        },
      ],
      order: [["id", "ASC"]],
      transaction: tx,
    });

    for (const actor of actors) {
      const state = parseMaybeJsonObject(actor.state_json) || {};
      const progress = resolveConstructionProgress(state, nowMs);
      if (!progress.isRunning) continue;
      if (progress.progressMs < progress.durationMs) continue;

      const actorId = String(actor.id);
      if (completingShelters.has(actorId)) {
        continue;
      }

      const ownerUserId = Number(state?.ownerUserId ?? state?.owner_user_id ?? 0);
      if (!Number.isInteger(ownerUserId) || ownerUserId <= 0) continue;

      console.log("[BUILD][PROGRESS] completing shelter", {
        instanceId,
        actorId: Number(actor.id),
        ownerUserId,
        progressMs: progress.progressMs,
        durationMs: progress.durationMs,
      });

      completingShelters.add(actorId);
      try {
        const config = buildPrimitiveShelterConfig(state);
        const nextState = {
          ...state,
          constructionState: "COMPLETED",
          constructionProgressMs: progress.durationMs,
          constructionCompletedAtMs: nowMs,
          constructionStartedAtMs:
            Number.isFinite(Number(state?.constructionStartedAtMs ?? state?.construction_started_at_ms ?? 0))
              ? Number(state?.constructionStartedAtMs ?? state?.construction_started_at_ms)
              : null,
          constructionDurationMs: progress.durationMs,
          buildRequirements: Array.isArray(config.buildRequirements) ? config.buildRequirements : [],
          buildSkillCode: config.buildSkillCode,
          buildXpReward: config.buildXpReward,
          buildMaterialsContainerId: null,
          buildMaterialsSlotCount: 0,
          canCancel: false,
          canBuild: false,
        };

        const nextRev = Number(actor.rev ?? 0) + 1;
        try {
          await actor.update(
            {
              state_json: nextState,
              rev: nextRev,
            },
            { transaction: tx }
          );
        } catch (error) {
          const code = String(error?.original?.code ?? error?.parent?.code ?? error?.code ?? "").toUpperCase();
          const message = String(error?.message ?? error?.original?.message ?? error?.parent?.message ?? "");
          if (code === "ER_CHECKREAD" || message.includes("Record has changed since last read")) {
            console.warn("[BUILD][PROGRESS] completion skipped due to concurrent change", {
              instanceId,
              actorId: Number(actor.id),
              ownerUserId,
            });
            continue;
          }
          throw error;
        }

        await awardSkillXp(ownerUserId, config.buildSkillCode, config.buildXpReward, tx);

        const invRt = await ensureInventoryLoaded(ownerUserId);
        await consumePrimitiveShelterMaterialsContainer({
          userId: ownerUserId,
          actorId: Number(actor.id),
          invRt,
          tx,
        });

        actor.state_json = nextState;
        actor.rev = nextRev;
        completedActors.push(actor);

        const ownerRuntime = getRuntime(ownerUserId);
        if (ownerRuntime?.buildLock?.active && String(ownerRuntime.buildLock?.actorId ?? "") === String(actor.id)) {
          ownerRuntime.buildLock = null;
          bumpRev(ownerRuntime);
          markRuntimeDirty(ownerUserId, nowMs);
          if (io) {
            await emitPlayerState(io, ownerRuntime);
          }
        }

        const activeSocket = getActiveSocket(ownerUserId);
        if (activeSocket) {
          clearInventory(ownerUserId);
          const freshInvRt = await ensureInventoryLoaded(ownerUserId);
          const freshEqRt = await ensureEquipmentLoaded(ownerUserId);
          activeSocket.emit("inv:full", buildInventoryFull(freshInvRt, freshEqRt));
        }
      } finally {
        completingShelters.delete(actorId);
      }
    }
  });

  for (const actor of completedActors) {
    updateActorState(actor.id, parseMaybeJsonObject(actor.state_json) || null);
    if (io) {
      io.to(`inst:${Number(actor.instance_id)}`).emit("actor:updated", {
        actorId: String(actor.id),
        actor: buildActorPayload(actor),
      });
    }
  }

  return completedActors;
}

async function processBuildProgressPhase(io, runtimes, nowMs = Date.now()) {
  const instanceIds = Array.from(
    new Set(
      (Array.isArray(runtimes) ? runtimes : [])
        .map((rt) => Number(rt?.instanceId ?? rt?.instance_id ?? 0))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );

  for (const instanceId of instanceIds) {
    await completeDuePrimitiveSheltersForInstance(instanceId, nowMs, io);
  }
}

module.exports = {
  completeDuePrimitiveSheltersForInstance,
  processBuildProgressPhase,
};
