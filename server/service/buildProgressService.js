"use strict";

const db = require("../models");
const { buildActorPayload } = require("./actorLoader/payload");
const { updateActorState } = require("../state/actorsRuntimeStore");
const { getRuntime, markRuntimeDirty } = require("../state/runtimeStore");
const { bumpRev } = require("../state/movement/entity");
const { emitPlayerState } = require("../state/movement/tickOnce/playerMovementPhase/emitPlayerState");
const { awardSkillXp } = require("./skillProgressionService");
const { buildPrimitiveShelterConfig, resolveConstructionProgress } = require("./buildService");

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
      lock: tx.LOCK.UPDATE,
    });

    for (const actor of actors) {
      const state = parseMaybeJsonObject(actor.state_json) || {};
      const progress = resolveConstructionProgress(state, nowMs);
      if (!progress.isRunning) continue;
      if (progress.progressMs < progress.durationMs) continue;

      const ownerUserId = Number(state?.ownerUserId ?? state?.owner_user_id ?? 0);
      if (!Number.isInteger(ownerUserId) || ownerUserId <= 0) continue;

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
        canCancel: false,
        canBuild: false,
      };

      const nextRev = Number(actor.rev ?? 0) + 1;
      await actor.update(
        {
          state_json: nextState,
          rev: nextRev,
        },
        { transaction: tx }
      );

      await awardSkillXp(ownerUserId, config.buildSkillCode, config.buildXpReward, tx);

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
