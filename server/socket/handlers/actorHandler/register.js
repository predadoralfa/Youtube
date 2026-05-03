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
        await actor.update(
          {
            pos_x: pos.x,
            pos_y: pos.y,
            pos_z: pos.z,
            rev: nextRev,
          },
          { transaction: tx }
        );

        await tx.commit();

        actor.pos_x = pos.x;
        actor.pos_y = pos.y;
        actor.pos_z = pos.z;
        actor.rev = nextRev;

        updateActorPos(actor.id, pos);

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
