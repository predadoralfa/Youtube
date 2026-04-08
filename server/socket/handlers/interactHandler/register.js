"use strict";

const db = require("../../../models");
const {
  ensureRuntimeLoaded,
  getRuntime,
  isWASDActive,
} = require("../../../state/runtimeStore");
const { getEnemy } = require("../../../state/enemies/enemiesRuntimeStore");
const {
  DEFAULT_STOP_RADIUS,
  DEFAULT_TIMEOUT_MS,
} = require("../../../config/interactionConstants");
const { isFiniteNumber } = require("./shared");
const { resolveNearbyCollectTarget } = require("./collect");
const { resolveTargetPos } = require("./targeting");
const { applyApproach } = require("./movement");
const { startEnemyCombat } = require("./combat");

function registerInteractHandler(io, socket) {
  socket.on("interact:start", async (payload = {}) => {
    try {
      if (socket.data?._worldJoined !== true) return;

      const userId = socket.data.userId;
      const nowMs = Date.now();

      await ensureRuntimeLoaded(userId);
      const rt = getRuntime(userId);
      if (!rt) return;

      const stats = await db.GaUserStats.findByPk(userId, {
        attributes: ["collect_cooldown_ms"],
      });
      rt.collectCooldownMs = stats?.collect_cooldown_ms ?? 1000;

      if (
        rt.connectionState === "DISCONNECTED_PENDING" ||
        rt.connectionState === "OFFLINE"
      ) {
        return;
      }

      if (isWASDActive(rt, nowMs)) return;

      const autoCollectTarget = payload?.target ? null : resolveNearbyCollectTarget(rt);
      const target = payload?.target ?? autoCollectTarget ?? null;
      if (!target?.kind || target?.id == null) return;

      const targetKind = String(target.kind);
      if (targetKind === "PLAYER" && String(target.id) === String(userId)) return;
      if (!["PLAYER", "ACTOR", "ENEMY"].includes(targetKind)) return;

      const stopRadiusRaw = payload?.stopRadius;
      const stopRadius =
        isFiniteNumber(stopRadiusRaw) && stopRadiusRaw > 0
          ? stopRadiusRaw
          : autoCollectTarget?.stopRadius ?? DEFAULT_STOP_RADIUS;

      const timeoutMsRaw = payload?.timeoutMs;
      const timeoutMs =
        isFiniteNumber(timeoutMsRaw) && timeoutMsRaw > 0
          ? timeoutMsRaw
          : DEFAULT_TIMEOUT_MS;

      const targetPos = resolveTargetPos({
        requesterRt: rt,
        target: { kind: targetKind, id: String(target.id) },
      });
      if (!targetPos) return;

      if (targetKind === "ENEMY") {
        const cleanEnemyId = String(target.id).replace(/^enemy_/, "");
        const enemy = getEnemy(cleanEnemyId);
        if (!enemy || String(enemy.status) !== "ALIVE") return;
        startEnemyCombat({ enemy, attackerUserId: userId, rt });
      } else {
        const moveOk = applyApproach({ rt, nowMs, targetPos, stopRadius });
        if (!moveOk) return;
      }

      rt.interact = {
        active: true,
        kind: targetKind,
        id: String(target.id),
        stopRadius,
        startedAtMs: nowMs,
        timeoutMs,
      };
    } catch (e) {
      console.error("[INTERACT_DEBUG] start error:", e);
    }
  });

  socket.on("interact:stop", async () => {
    try {
      if (socket.data?._worldJoined !== true) return;

      const userId = socket.data.userId;
      await ensureRuntimeLoaded(userId);
      const rt = getRuntime(userId);
      if (!rt) return;

      const cur = rt.interact;
      if (!cur?.active) return;

      if (cur.kind === "ENEMY") {
        if (rt.combat) {
          rt.combat.state = "IDLE";
          rt.combat.targetId = null;
          rt.combat.targetKind = null;
        }

        rt.moveMode = "STOP";
        rt.moveTarget = null;
        rt.moveStopRadius = null;
        rt.action = "idle";
      }

      rt.interact = null;
    } catch (e) {
      console.error("[INTERACT_DEBUG] stop error:", e);
    }
  });
}

module.exports = {
  registerInteractHandler,
};
