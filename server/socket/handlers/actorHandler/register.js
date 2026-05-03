"use strict";

const db = require("../../../models");
const { ensureRuntimeLoaded, getRuntime } = require("../../../state/runtimeStore");
const { updateActorPos } = require("../../../state/actorsRuntimeStore");
const { buildActorPayload } = require("../../../service/actorLoader/payload");

function safeAck(ack, payload) {
  if (typeof ack === "function") {
    try {
      ack(payload);
    } catch {}
  }
}

function normalizePosition(pos) {
  if (!pos || typeof pos !== "object") return null;

  const x = Number(pos.x);
  const y = Number(pos.y);
  const z = Number(pos.z);
  if (![x, y, z].every(Number.isFinite)) return null;

  return { x, y, z };
}

function normalizeYaw(payload) {
  const rawYaw =
    payload?.yaw ??
    payload?.rotation?.y ??
    payload?.rotationY ??
    payload?.rotY ??
    null;
  const yaw = Number(rawYaw);
  return Number.isFinite(yaw) ? yaw : null;
}

function normalizeScale(payload) {
  const scale = payload?.scale ?? null;
  const hasScale =
    scale != null ||
    payload?.scaleX != null ||
    payload?.scaleY != null ||
    payload?.scaleZ != null ||
    payload?.scale_x != null ||
    payload?.scale_y != null ||
    payload?.scale_z != null;
  if (!hasScale) return null;

  const sx = Number(scale?.x ?? payload?.scaleX ?? payload?.scale_x ?? 1);
  const sy = Number(scale?.y ?? payload?.scaleY ?? payload?.scale_y ?? 1);
  const sz = Number(scale?.z ?? payload?.scaleZ ?? payload?.scale_z ?? 1);

  if (![sx, sy, sz].every(Number.isFinite)) return null;
  return { x: sx, y: sy, z: sz };
}

function registerActorHandler(io, socket) {
  socket.on("actor:update_position", async (payload = {}, ack) => {
    try {
      if (socket.data?._worldJoined !== true) return;

      const userId = socket.data.userId;
      await ensureRuntimeLoaded(userId);

      const rt = getRuntime(userId);
      if (!rt) {
        return safeAck(ack, {
          ok: false,
          code: "RUNTIME_NOT_FOUND",
          message: "Runtime not found",
        });
      }

      const actorId = Number(payload?.actorId);
      const pos = normalizePosition(payload?.pos ?? payload?.position ?? null);
      const yaw = normalizeYaw(payload);
      const scale = normalizeScale(payload);

      if (!Number.isInteger(actorId) || actorId <= 0) {
        return safeAck(ack, {
          ok: false,
          code: "INVALID_ACTOR_ID",
          message: "Invalid actor id",
        });
      }

      if (!pos) {
        return safeAck(ack, {
          ok: false,
          code: "INVALID_POSITION",
          message: "Invalid actor position",
        });
      }

      const tx = await db.sequelize.transaction();
      try {
        const actor = await db.GaActorRuntime.findByPk(actorId, {
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
          await tx.rollback().catch(() => {});
          return safeAck(ack, {
            ok: false,
            code: "ACTOR_NOT_FOUND",
            message: "Actor not found",
          });
        }

        if (Number(actor.instance_id) !== Number(rt.instanceId)) {
          await tx.rollback().catch(() => {});
          return safeAck(ack, {
            ok: false,
            code: "ACTOR_INSTANCE_MISMATCH",
            message: "Actor does not belong to the current instance",
          });
        }

        if (String(actor.status ?? "").toUpperCase() !== "ACTIVE") {
          await tx.rollback().catch(() => {});
          return safeAck(ack, {
            ok: false,
            code: "ACTOR_NOT_ACTIVE",
            message: "Actor is not active",
          });
        }

        const nextRev = Number(actor.rev ?? 0) + 1;
        const nextUpdate = {
          pos_x: pos.x,
          pos_y: pos.y,
          pos_z: pos.z,
          rev: nextRev,
        };

        if (yaw != null) {
          nextUpdate.yaw = yaw;
        }

        if (scale) {
          nextUpdate.scale_x = scale.x;
          nextUpdate.scale_y = scale.y;
          nextUpdate.scale_z = scale.z;
        }

        console.log("[PANEL_DB] actor:update_position -> pending", {
          actorId: String(actor.id),
          instanceId: Number(actor.instance_id),
          revFrom: Number(actor.rev ?? 0),
          revTo: nextRev,
          pos,
          yaw: yaw != null ? yaw : null,
          scale: scale ?? null,
          fields: Object.keys(nextUpdate),
        });

        await actor.update(nextUpdate, { transaction: tx });

        await tx.commit();

        actor.pos_x = pos.x;
        actor.pos_y = pos.y;
        actor.pos_z = pos.z;
        if (yaw != null) {
          actor.yaw = yaw;
        }
        if (scale) {
          actor.scale_x = scale.x;
          actor.scale_y = scale.y;
          actor.scale_z = scale.z;
        }
        actor.rev = nextRev;

        updateActorPos(actor.id, pos, yaw, scale);

        console.log("[PANEL_DB] actor:update_position -> committed", {
          actorId: String(actor.id),
          instanceId: Number(actor.instance_id),
          rev: actor.rev,
          pos: {
            x: Number(actor.pos_x ?? 0),
            y: Number(actor.pos_y ?? 0),
            z: Number(actor.pos_z ?? 0),
          },
          yaw: actor.yaw != null ? Number(actor.yaw) : null,
          scale:
            actor.scale_x != null || actor.scale_y != null || actor.scale_z != null
              ? {
                  x: Number(actor.scale_x ?? 1),
                  y: Number(actor.scale_y ?? 1),
                  z: Number(actor.scale_z ?? 1),
                }
              : null,
        });

        const actorPayload = buildActorPayload(actor);
        io.to(`inst:${Number(actor.instance_id)}`).emit("actor:updated", {
          actorId: String(actor.id),
          actor: actorPayload,
        });

        return safeAck(ack, {
          ok: true,
          actorId: String(actor.id),
          actor: actorPayload,
        });
      } catch (error) {
        await tx.rollback().catch(() => {});
        return safeAck(ack, {
          ok: false,
          code: error?.code || "ACTOR_UPDATE_ERR",
          message: error?.message || "Failed to update actor position",
        });
      }
    } catch (error) {
      return safeAck(ack, {
        ok: false,
        code: error?.code || "ACTOR_UPDATE_ERR",
        message: error?.message || "Failed to update actor position",
      });
    }
  });
}

module.exports = {
  registerActorHandler,
};
