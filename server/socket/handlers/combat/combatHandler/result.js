"use strict";

const { createLootContainerForEnemy } = require("../../../../service/lootService");
const { COMBAT_BASE_COOLDOWN_MS } = require("../../../../config/combatConstants");
const { resolveFeverDebuffTempoMultiplier } = require("../../../../state/conditions/fever");

async function applySuccessfulAttack({
  io,
  socket,
  userId,
  attackerRuntime,
  attackerStats,
  attackerInstanceId,
  targetEnemy,
  targetKind,
  combatResult,
  nowMs,
}) {
  attackerRuntime._lastAttackAtMs = nowMs;
  if (!attackerRuntime.combat) attackerRuntime.combat = {};
  attackerRuntime.combat.lastAttackAtMs = nowMs;

  if (targetEnemy) {
    targetEnemy._combatMode = true;
    targetEnemy._combatActive = true;
    targetEnemy._combatTargetId = userId;
    targetEnemy._combatStartedAtMs = nowMs;
    targetEnemy._lastAttackAtMs = 0;

    if (!targetEnemy._spawnPos) {
      targetEnemy._spawnPos = { x: targetEnemy.pos.x, z: targetEnemy.pos.z };
    }
  }

  io.to(`inst:${attackerInstanceId}`).emit("combat:damage_taken", {
    attackerId: userId,
    targetId: `enemy_${targetEnemy.id}`,
    targetKind,
    damage: combatResult.damage,
    targetHPBefore: combatResult.targetHPBefore,
    targetHPAfter: combatResult.targetHPAfter,
    targetHPMax: combatResult.targetHPMax,
    targetDied: combatResult.targetDied,
    timestamp: nowMs,
  });

  socket.emit("combat:attack_result", {
    ok: true,
    damage: combatResult.damage,
    targetHPAfter: combatResult.targetHPAfter,
    targetHPMax: combatResult.targetHPMax,
    targetDied: combatResult.targetDied,
    cooldownMs:
      (COMBAT_BASE_COOLDOWN_MS / (attackerStats.attackSpeed || 1)) *
      resolveFeverDebuffTempoMultiplier(
        attackerRuntime?.status?.fever?.current ?? attackerRuntime?.diseaseLevel ?? 0,
        attackerRuntime?.status?.fever?.severity ?? attackerRuntime?.diseaseSeverity ?? 0
      ),
    staminaCost: combatResult.staminaCost,
    staminaBefore: combatResult.staminaBefore,
    staminaAfter: combatResult.staminaAfter,
    staminaMax: combatResult.staminaMax,
  });

  if (combatResult.targetDied && targetKind === "ENEMY") {
    targetEnemy._combatMode = false;
    targetEnemy._combatActive = false;
    targetEnemy.status = "DEAD";

    const lootContainer = await createLootContainerForEnemy(
      targetEnemy.id,
      targetEnemy.enemy_def_id,
      {
        x: Number(targetEnemy.pos?.x ?? 0),
        z: Number(targetEnemy.pos?.z ?? 0),
      }
    );

    if (lootContainer) {
      io.to(`inst:${attackerInstanceId}`).emit("world:object_spawn", {
        objectId: lootContainer.containerId,
        objectKind: "CONTAINER",
        position: lootContainer.position,
        containerDefId: lootContainer.containerDefId,
        slotCount: lootContainer.slotCount,
      });
    }
  }
}

module.exports = {
  applySuccessfulAttack,
};
