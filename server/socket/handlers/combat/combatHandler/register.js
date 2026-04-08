"use strict";

const { executeAttack } = require("../../../../service/combatSystem");
const { loadAttackerOrThrow, validateCooldown } = require("./attacker");
const { resolveTarget, validateRange } = require("./target");
const { applySuccessfulAttack } = require("./result");

async function onCombatAttack(socket, io, payload) {
  try {
    const userId = socket.data.userId;
    if (!userId) {
      return socket.emit("combat:attack_result", {
        ok: false,
        error: "NOT_AUTHENTICATED",
      });
    }

    const { targetId, targetKind } = payload || {};
    if (!targetId || !targetKind) {
      return socket.emit("combat:attack_result", {
        ok: false,
        error: "MISSING_TARGET",
      });
    }

    const { attackerRuntime, attackerStats, attackerInstanceId, attackerPos } =
      await loadAttackerOrThrow(userId);

    const nowMs = Date.now();
    const cooldown = validateCooldown(attackerRuntime, attackerStats, nowMs);
    if (!cooldown.ok) {
      return socket.emit("combat:attack_result", {
        ok: false,
        error: "COOLDOWN_ACTIVE",
        cooldownRemaining: cooldown.cooldownRemaining,
      });
    }

    const { targetEnemy, targetStats, targetDefense, targetPos } = await resolveTarget({
      attackerInstanceId,
      targetId,
      targetKind,
    });

    const attackRange = Number(attackerStats.attackRange);
    const range = validateRange(attackerPos, targetPos, attackRange, userId);
    if (!range.ok) {
      return socket.emit("combat:attack_result", {
        ok: false,
        error: "OUT_OF_RANGE",
        distance: range.distance,
        range: range.range,
      });
    }

    const combatResult = await executeAttack({
      attackerId: userId,
      attackerKind: "PLAYER",
      targetId: targetEnemy.id,
      targetKind,
      attackerPos,
      targetPos,
      attackerAttackPower: attackerStats.attackPower,
      attackerAttackSpeed: attackerStats.attackSpeed,
      targetDefense,
      attackRange,
      lastAttackAtMs: attackerRuntime._lastAttackAtMs,
      nowMs,
    });

    if (!combatResult.ok) {
      return socket.emit("combat:attack_result", {
        ok: false,
        error: combatResult.error,
        details: combatResult,
        staminaCost: combatResult.staminaCost,
        staminaBefore: combatResult.staminaBefore,
        staminaAfter: combatResult.staminaAfter,
        staminaMax: combatResult.staminaMax,
      });
    }

    await applySuccessfulAttack({
      io,
      socket,
      userId,
      attackerRuntime,
      attackerStats,
      attackerInstanceId,
      targetEnemy,
      targetStats,
      targetKind,
      combatResult,
      nowMs,
    });
  } catch (err) {
    socket.emit("combat:attack_result", {
      ok: false,
      error: err.code || "INTERNAL_ERROR",
      details: err.message,
    });
  }
}

function registerCombatHandlers(socket, io) {
  socket.on("combat:attack", (payload) => onCombatAttack(socket, io, payload));
  console.log(`[COMBAT] handlers registrados para socket ${socket.id}`);
}

module.exports = {
  registerCombatHandlers,
};
