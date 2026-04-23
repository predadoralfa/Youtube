"use strict";

const db = require("../../../models");
const {
  ensureRuntimeLoaded,
  getRuntime,
  isWASDActive,
} = require("../../../state/runtimeStore");
const { getEnemy } = require("../../../state/enemies/enemiesRuntimeStore");
const { getActor } = require("../../../state/actorsRuntimeStore");
const {
  DEFAULT_STOP_RADIUS,
  DEFAULT_TIMEOUT_MS,
} = require("../../../config/interactionConstants");
const { isFiniteNumber } = require("./shared");
const { resolveNearbyCollectTarget } = require("./collect");
const { resolveTargetPos } = require("./targeting");
const { applyApproach } = require("./movement");
const { startEnemyCombat } = require("./combat");
const { resolveActorCollectCooldownMs } = require("../../../service/actorCollectService");
const { DEFAULT_COLLECT_COOLDOWN_MS } = require("../../../config/interactionConstants");
const { stopMovement } = require("../../../state/movement/input");
const { emitPlayerState } = require("../../../state/movement/tickOnce/playerMovementPhase/emitPlayerState");
const { resolveCarryWeightContext } = require("../../../state/movement/tickOnce/carryWeight");
const { processAutomaticCombat } = require("../../../state/movement/tickOnce/playerCombat");
const { advanceRuntimeMovementPhase } = require("../../../state/movement/tickOnce/playerMovementPhase/processPhase");

function registerInteractHandler(io, socket) {
  socket.on("interact:start", async (payload = {}) => {
    try {
      if (socket.data?._worldJoined !== true) return;

      const userId = socket.data.userId;
      const receivedAtMs = Date.now();

      await ensureRuntimeLoaded(userId);
      const rt = getRuntime(userId);
      if (!rt) return;

      const stats = await db.GaUserStats.findByPk(userId, {
        attributes: ["collect_cooldown_ms"],
      });
      rt.collectCooldownMs = stats?.collect_cooldown_ms ?? DEFAULT_COLLECT_COOLDOWN_MS;

      if (
        rt.connectionState === "DISCONNECTED_PENDING" ||
        rt.connectionState === "OFFLINE"
      ) {
        return;
      }

      if (rt.buildLock?.active || rt.sleepLock?.active) return;

      if (isWASDActive(rt, receivedAtMs)) return;

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

      if (targetKind === "ACTOR") {
        const actor = getActor(String(target.id));
        const baseCollectCooldownMs = stats?.collect_cooldown_ms ?? DEFAULT_COLLECT_COOLDOWN_MS;
        rt.collectCooldownMs = await resolveActorCollectCooldownMs(
          userId,
          actor,
          baseCollectCooldownMs
        );
      } else {
        rt.collectCooldownMs = stats?.collect_cooldown_ms ?? DEFAULT_COLLECT_COOLDOWN_MS;
      }

      if (targetKind === "ENEMY") {
        const cleanEnemyId = String(target.id).replace(/^enemy_/, "");
        const enemy = getEnemy(cleanEnemyId);
        if (!enemy || String(enemy.status) !== "ALIVE") return;
        startEnemyCombat({ enemy, attackerUserId: userId, rt });
      } else {
        const inputAtMs = Date.now();
        const moveOk = applyApproach({ rt, nowMs: inputAtMs, targetPos, stopRadius });
        if (!moveOk) return;

        const advanceAtMs = Date.now();
        await advanceRuntimeMovementPhase(
          socket.server,
          rt,
          advanceAtMs,
          resolveCarryWeightContext,
          processAutomaticCombat
        );

        const emitAtMs = Date.now();
        await emitPlayerState(socket.server, rt, {
          nowMs: emitAtMs,
          force: true,
          includeInterest: false,
        });
      }

      rt.interact = {
        active: true,
        kind: targetKind,
        id: String(target.id),
        stopRadius,
        startedAtMs: receivedAtMs,
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

        stopMovement(rt);
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
