"use strict";

const db = require("../../../models");
const { ensureRuntimeLoaded, getRuntime, markRuntimeDirty } = require("../../../state/runtimeStore");
const { getActiveSocket } = require("../../../socket/sessionIndex");
const { bumpRev } = require("../../../state/movement/entity");
const { emitPlayerState } = require("../../../state/movement/tickOnce/playerMovementPhase/emitPlayerState");
const {
  resolvePrimitiveShelterDistance,
  PRIMITIVE_SHELTER_APPROACH_RADIUS,
} = require("../../../service/buildService");
const {
  startPrimitiveShelterSleep,
  stopPrimitiveShelterSleep,
} = require("../../../service/primitiveShelterSleepService");
const { applyApproach } = require("../interactHandler/movement");

function safeAck(ack, payload) {
  if (typeof ack === "function") {
    try {
      ack(payload);
    } catch {}
  }
}

function parseMaybeJsonObject(value) {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function isCompletedPrimitiveShelter(actor) {
  const state = parseMaybeJsonObject(actor?.state_json) || {};
  const actorCode = String(actor?.actorDef?.code ?? actor?.actor_def_code ?? "").trim().toUpperCase();
  if (actorCode !== "PRIMITIVE_SHELTER") return { ok: false, reason: "NOT_SHELTER" };

  const ownerUserId = Number(state?.ownerUserId ?? state?.owner_user_id ?? 0);
  if (!Number.isInteger(ownerUserId) || ownerUserId <= 0) return { ok: false, reason: "NOT_OWNER" };

  const constructionState = String(state?.constructionState ?? "PLANNED").trim().toUpperCase();
  if (constructionState !== "COMPLETED") return { ok: false, reason: "NOT_COMPLETED" };

  return {
    ok: true,
    state,
    ownerUserId,
  };
}

function registerSleepHandler(io, socket) {
  socket.on("sleep:start", async (payload = {}, ack) => {
    try {
      if (socket.data?._worldJoined !== true) return;

      const userId = socket.data.userId;
      await ensureRuntimeLoaded(userId);
      const rt = getRuntime(userId);
      if (!rt) return;

      if (rt.buildLock?.active) {
        return safeAck(ack, {
          ok: false,
          code: "BUILD_LOCKED",
          message: "Build lock is active",
        });
      }

      if (rt.sleepLock?.active) {
        return safeAck(ack, {
          ok: true,
          sleeping: true,
          pending: false,
        });
      }

      const actorId = Number(payload?.actorId);
      if (!Number.isInteger(actorId) || actorId <= 0) {
        return safeAck(ack, {
          ok: false,
          code: "INVALID_ACTOR_ID",
          message: "Invalid actor id",
        });
      }

      const actor = await db.GaActorRuntime.findByPk(actorId, {
        include: [
          {
            association: "actorDef",
            required: true,
          },
        ],
      });

      if (!actor) {
        return safeAck(ack, {
          ok: false,
          code: "ACTOR_NOT_FOUND",
          message: "Shelter not found",
        });
      }

      const shelter = isCompletedPrimitiveShelter(actor);
      if (!shelter.ok) {
        return safeAck(ack, {
          ok: false,
          code: shelter.reason,
          message:
            shelter.reason === "NOT_COMPLETED"
              ? "Primitive Shelter is not completed yet"
              : "This shelter cannot be used",
        });
      }

      if (Number(shelter.ownerUserId) !== Number(userId)) {
        return safeAck(ack, {
          ok: false,
          code: "NOT_OWNER",
          message: "Only the owner can sleep here",
        });
      }

      const distance = resolvePrimitiveShelterDistance(rt.pos ?? null, {
        x: actor.pos_x,
        z: actor.pos_z,
      });

      if (distance > PRIMITIVE_SHELTER_APPROACH_RADIUS) {
        const moved = applyApproach({
          rt,
          nowMs: Date.now(),
          targetPos: { x: Number(actor.pos_x ?? 0), z: Number(actor.pos_z ?? 0) },
          stopRadius: PRIMITIVE_SHELTER_APPROACH_RADIUS,
        });

        rt.pendingSleep = {
          actorId: String(actorId),
          requestedAtMs: Date.now(),
        };
        rt.sleepLock = {
          active: false,
          pending: true,
          actorId: String(actorId),
          kind: "PRIMITIVE_SHELTER",
          requestedAtMs: Date.now(),
        };
        rt.interact = {
          active: true,
          kind: "ACTOR",
          id: String(actorId),
          stopRadius: PRIMITIVE_SHELTER_APPROACH_RADIUS,
          startedAtMs: Date.now(),
          timeoutMs: 60000,
        };

        if (!moved) {
          console.warn("[SLEEP][SERVER] failed to queue approach", {
            userId,
            actorId,
          });
        }

        bumpRev(rt);
        markRuntimeDirty(userId, Date.now());
        await emitPlayerState(io, rt);

        return safeAck(ack, {
          ok: true,
          pending: true,
          actorId,
        });
      }

      startPrimitiveShelterSleep(rt, actorId);
      bumpRev(rt);
      markRuntimeDirty(userId, Date.now());
      await emitPlayerState(io, rt);

      return safeAck(ack, {
        ok: true,
        sleeping: true,
        pending: false,
        actorId,
      });
    } catch (error) {
      return safeAck(ack, {
        ok: false,
        code: error?.code || "SLEEP_ERR",
        message: error?.message || "Failed to start sleep",
      });
    }
  });

  socket.on("sleep:stop", async (_payload = {}, ack) => {
    try {
      if (socket.data?._worldJoined !== true) return;

      const userId = socket.data.userId;
      await ensureRuntimeLoaded(userId);
      const rt = getRuntime(userId);
      if (!rt) return;

      if (!rt.sleepLock?.active && !rt.pendingSleep) {
        return safeAck(ack, {
          ok: true,
          sleeping: false,
        });
      }

      stopPrimitiveShelterSleep(rt);
      bumpRev(rt);
      markRuntimeDirty(userId, Date.now());
      await emitPlayerState(io, rt);

      return safeAck(ack, {
        ok: true,
        sleeping: false,
      });
    } catch (error) {
      return safeAck(ack, {
        ok: false,
        code: error?.code || "SLEEP_ERR",
        message: error?.message || "Failed to stop sleep",
      });
    }
  });
}

module.exports = {
  registerSleepHandler,
};
