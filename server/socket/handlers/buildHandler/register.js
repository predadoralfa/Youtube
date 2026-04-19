"use strict";

const db = require("../../../models");
const { ensureRuntimeLoaded, getRuntime } = require("../../../state/runtimeStore");
const { addActor, removeActor } = require("../../../state/actorsRuntimeStore");
const { withInventoryLock } = require("../../../state/inventory/store");
const { ensureInventoryLoaded } = require("../../../state/inventory/loader");
const { ensureEquipmentLoaded } = require("../../../state/equipment/loader");
const { emitFullAndAck } = require("../inventoryHandler/context");
const {
  placePrimitiveShelter,
  startPrimitiveShelterConstruction,
  cancelPrimitiveShelter,
  pausePrimitiveShelterConstruction,
  resumePrimitiveShelterConstruction,
  resolvePrimitiveShelterDistance,
  PRIMITIVE_SHELTER_APPROACH_RADIUS,
} = require("../../../service/buildService");
const { applyApproach } = require("../interactHandler/movement");

function safeAck(ack, payload) {
  if (typeof ack === "function") {
    try {
      ack(payload);
    } catch {}
  }
}

function registerBuildHandler(io, socket) {
  socket.on("build:place", async (payload = {}, ack) => {
    try {
      if (socket.data?._worldJoined !== true) return;

      const userId = socket.data.userId;
      await ensureRuntimeLoaded(userId);
      const rt = getRuntime(userId);
      if (!rt) return;
      if (rt.sleepLock?.active) {
        return safeAck(ack, {
          ok: false,
          code: "SLEEP_ACTIVE",
          message: "Wake up before building",
        });
      }

      const tx = await db.sequelize.transaction();
      try {
        const result = await placePrimitiveShelter({
          userId,
          instanceId: rt.instanceId,
          worldPos: payload?.worldPos ?? null,
          tx,
        });

        if (!result?.ok) {
          await tx.rollback().catch(() => {});
          return safeAck(ack, result);
        }

        await tx.commit();

        const actor = result.actorPayload;
        addActor(actor);
        io.to(`inst:${Number(rt.instanceId)}`).emit("world:object_spawn", {
          objectKind: "ACTOR",
          actor,
        });

        return safeAck(ack, {
          ok: true,
          actorId: result.actorId,
          spawnId: result.spawnId,
          actor,
        });
      } catch (error) {
        await tx.rollback().catch(() => {});
        return safeAck(ack, {
          ok: false,
          code: error?.code || "BUILD_ERR",
          message: error?.message || "Failed to place build",
        });
      }
    } catch (error) {
      return safeAck(ack, {
        ok: false,
        code: error?.code || "BUILD_ERR",
        message: error?.message || "Failed to place build",
      });
    }
  });

  socket.on("build:start", async (payload = {}, ack) => {
    try {
      if (socket.data?._worldJoined !== true) return;

      const userId = socket.data.userId;
      await ensureRuntimeLoaded(userId);
      const rt = getRuntime(userId);
      if (!rt) return;
      if (rt.sleepLock?.active) {
        return safeAck(ack, {
          ok: false,
          code: "SLEEP_ACTIVE",
          message: "Wake up before building",
        });
      }

      await withInventoryLock(userId, async () => {
        const invRt = await ensureInventoryLoaded(userId);
        const eqRt = await ensureEquipmentLoaded(userId);

        const tx = await db.sequelize.transaction();
        try {
          const actorId = Number(payload?.actorId);
          if (!Number.isInteger(actorId) || actorId <= 0) {
            await tx.rollback().catch(() => {});
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
            transaction: tx,
            lock: tx?.LOCK?.SHARE,
          });

          if (!actor) {
            await tx.rollback().catch(() => {});
            return safeAck(ack, {
              ok: false,
              code: "ACTOR_NOT_FOUND",
              message: "Build actor not found",
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

            rt.pendingBuild = {
              actorId: String(actorId),
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
              console.warn("[BUILD][SERVER] failed to queue approach", {
                userId,
                actorId,
              });
            }

            return safeAck(ack, {
              ok: true,
              pending: true,
              actorId,
            });
          }

          const result = await startPrimitiveShelterConstruction({
            userId,
            actorId,
            tx,
            inventoryRuntime: invRt,
            equipmentRuntime: eqRt,
          });

          if (!result?.ok) {
            await tx.rollback().catch(() => {});
            return safeAck(ack, result);
          }

          await tx.commit();

          addActor(result.actorPayload);
          rt.buildLock = {
            active: true,
            actorId: String(result.actorId),
          };
          rt.pendingBuild = null;
          rt.interact = null;
          rt.moveTarget = null;
          rt.moveMode = "STOP";
          rt.action = "idle";
          rt.inputDir = { x: 0, z: 0 };
          rt.inputDirAtMs = 0;
          io.to(`inst:${Number(rt.instanceId)}`).emit("actor:updated", {
            actorId: String(result.actorId),
            actor: result.actorPayload,
          });

          await emitFullAndAck(socket, invRt, eqRt, ack);
        } catch (error) {
          await tx.rollback().catch(() => {});
          try {
            const freshInvRt = await ensureInventoryLoaded(userId);
            const freshEqRt = await ensureEquipmentLoaded(userId);
            await emitFullAndAck(socket, freshInvRt, freshEqRt, null);
          } catch (reloadErr) {
            console.warn("[BUILD] failed to refresh inventory after build start error", {
              userId,
              error: String(reloadErr?.message || reloadErr),
            });
          }

          return safeAck(ack, {
            ok: false,
            code: error?.code || "BUILD_ERR",
            message: error?.message || "Failed to start build",
          });
        }
      });
    } catch (error) {
      return safeAck(ack, {
        ok: false,
        code: error?.code || "BUILD_ERR",
        message: error?.message || "Failed to start build",
      });
    }
  });

  socket.on("build:pause", async (payload = {}, ack) => {
    try {
      if (socket.data?._worldJoined !== true) return;

      const userId = socket.data.userId;
      await ensureRuntimeLoaded(userId);
      const rt = getRuntime(userId);
      if (!rt) return;

      const actorId = Number(payload?.actorId);
      if (!Number.isInteger(actorId) || actorId <= 0) {
        return safeAck(ack, {
          ok: false,
          code: "INVALID_ACTOR_ID",
          message: "Invalid actor id",
        });
      }

      const tx = await db.sequelize.transaction();
      try {
        const result = await pausePrimitiveShelterConstruction({
          userId,
          actorId,
          tx,
        });

        if (!result?.ok) {
          await tx.rollback().catch(() => {});
          return safeAck(ack, result);
        }

        await tx.commit();

        rt.buildLock = null;
        rt.pendingBuild = null;

        io.to(`inst:${Number(result.instanceId ?? rt.instanceId)}`).emit("actor:updated", {
          actorId: String(actorId),
          actor: result.actorPayload,
        });

        return safeAck(ack, {
          ok: true,
          actorId: String(actorId),
          actor: result.actorPayload,
        });
      } catch (error) {
        await tx.rollback().catch(() => {});
        return safeAck(ack, {
          ok: false,
          code: error?.code || "BUILD_ERR",
          message: error?.message || "Failed to pause build",
        });
      }
    } catch (error) {
      return safeAck(ack, {
        ok: false,
        code: error?.code || "BUILD_ERR",
        message: error?.message || "Failed to pause build",
      });
    }
  });

  socket.on("build:resume", async (payload = {}, ack) => {
    try {
      if (socket.data?._worldJoined !== true) return;

      const userId = socket.data.userId;
      await ensureRuntimeLoaded(userId);
      const rt = getRuntime(userId);
      if (!rt) return;

      const actorId = Number(payload?.actorId);
      if (!Number.isInteger(actorId) || actorId <= 0) {
        return safeAck(ack, {
          ok: false,
          code: "INVALID_ACTOR_ID",
          message: "Invalid actor id",
        });
      }

      const tx = await db.sequelize.transaction();
      try {
        const result = await resumePrimitiveShelterConstruction({
          userId,
          actorId,
          tx,
        });

        if (!result?.ok) {
          await tx.rollback().catch(() => {});
          return safeAck(ack, result);
        }

        await tx.commit();

        rt.buildLock = {
          active: true,
          actorId: String(actorId),
        };
        rt.pendingBuild = null;
        rt.interact = null;
        io.to(`inst:${Number(result.instanceId ?? rt.instanceId)}`).emit("actor:updated", {
          actorId: String(actorId),
          actor: result.actorPayload,
        });

        return safeAck(ack, {
          ok: true,
          actorId: String(actorId),
          actor: result.actorPayload,
        });
      } catch (error) {
        await tx.rollback().catch(() => {});
        return safeAck(ack, {
          ok: false,
          code: error?.code || "BUILD_ERR",
          message: error?.message || "Failed to resume build",
        });
      }
    } catch (error) {
      return safeAck(ack, {
        ok: false,
        code: error?.code || "BUILD_ERR",
        message: error?.message || "Failed to resume build",
      });
    }
  });

  socket.on("build:cancel", async (payload = {}, ack) => {
    try {
      console.log("[BUILD][SERVER] cancel request", {
        socketId: socket.id,
        userId: socket.data?.userId,
        payload,
      });

      if (socket.data?._worldJoined !== true) return;

      const userId = socket.data.userId;
      await ensureRuntimeLoaded(userId);
      const rt = getRuntime(userId);
      if (!rt) return;

      const actorId = Number(payload?.actorId);
      if (!Number.isInteger(actorId) || actorId <= 0) {
        return safeAck(ack, {
          ok: false,
          code: "INVALID_ACTOR_ID",
          message: "Invalid actor id",
        });
      }

      const tx = await db.sequelize.transaction();
      try {
        const result = await cancelPrimitiveShelter({
          userId,
          actorId,
          tx,
        });

        if (!result?.ok) {
          await tx.rollback().catch(() => {});
          return safeAck(ack, result);
        }

        await tx.commit();

        rt.buildLock = null;
        rt.pendingBuild = null;
        rt.interact = null;
        rt.moveTarget = null;
        rt.moveMode = "STOP";
        rt.action = "idle";
        rt.inputDir = { x: 0, z: 0 };
        rt.inputDirAtMs = 0;
        removeActor(String(actorId));
        io.to(`inst:${Number(result.instanceId ?? rt.instanceId)}`).emit("world:object_despawn", {
          objectKind: "ACTOR",
          actorId: String(actorId),
        });

        console.log("[BUILD][SERVER] cancel ok", {
          actorId: String(actorId),
          instanceId: Number(result.instanceId ?? rt.instanceId),
        });

        return safeAck(ack, {
          ok: true,
          actorId: String(actorId),
        });
      } catch (error) {
        await tx.rollback().catch(() => {});
        console.log("[BUILD][SERVER] cancel error", {
          message: error?.message,
          code: error?.code,
        });
        return safeAck(ack, {
          ok: false,
          code: error?.code || "BUILD_ERR",
          message: error?.message || "Failed to cancel build",
        });
      }
    } catch (error) {
      console.log("[BUILD][SERVER] cancel fatal", {
        message: error?.message,
        code: error?.code,
      });
      return safeAck(ack, {
        ok: false,
        code: error?.code || "BUILD_ERR",
        message: error?.message || "Failed to cancel build",
      });
    }
  });
}

module.exports = {
  registerBuildHandler,
};
