"use strict";

const db = require("../../models");
const { getRuntime, markStatsDirty } = require("../../state/runtimeStore");
const { markEnemyDead } = require("../enemyRespawnService");
const { COMBAT_BASE_COOLDOWN_MS } = require("../../config/combatConstants");
const { consumeAttackerStamina } = require("./stamina");

async function executeAttack(params) {
  const {
    attackerId,
    attackerKind,
    targetId,
    targetKind,
    attackerPos,
    targetPos,
    attackerAttackPower,
    attackerAttackSpeed,
    targetDefense,
    attackRange,
    lastAttackAtMs,
    nowMs,
  } = params;

  const dx = targetPos.x - attackerPos.x;
  const dz = targetPos.z - attackerPos.z;
  const dist = Math.hypot(dx, dz);

  if (dist > attackRange) {
    return {
      ok: false,
      error: "OUT_OF_RANGE",
      distance: dist,
      attackRange: attackRange,
    };
  }

  const cooldownMs = COMBAT_BASE_COOLDOWN_MS / attackerAttackSpeed;
  const timeSinceLastAttack = nowMs - lastAttackAtMs;

  if (timeSinceLastAttack < cooldownMs) {
    return {
      ok: false,
      error: "ON_COOLDOWN",
      cooldownRemaining: cooldownMs - timeSinceLastAttack,
      cooldownTotal: cooldownMs,
    };
  }

  const staminaConsumption = await consumeAttackerStamina(attackerId, attackerKind, attackRange);
  if (!staminaConsumption.ok) {
    return {
      ok: false,
      error: staminaConsumption.error,
      staminaCost: staminaConsumption.staminaCost,
      staminaBefore: staminaConsumption.staminaBefore,
      staminaAfter: staminaConsumption.staminaAfter,
      staminaMax: staminaConsumption.staminaMax,
    };
  }

  const baseDamage = Math.max(0, attackerAttackPower - targetDefense);
  const damage = baseDamage;

  let targetHPBefore = 0;
  let targetHPAfter = 0;
  let targetHPMax = 0;
  let targetDied = false;

  try {
    if (targetKind === "PLAYER") {
      const runtime = getRuntime(targetId);
      if (runtime) {
        const hpCurrent = Number(
          runtime.vitals?.hp?.current ??
            runtime.combat?.hpCurrent ??
            runtime.stats?.hpCurrent ??
            runtime.hpCurrent ??
            runtime.hp ??
            100
        );
        const hpMax = Number(
          runtime.vitals?.hp?.max ??
            runtime.combat?.hpMax ??
            runtime.stats?.hpMax ??
            runtime.hpMax ??
            100
        );

        targetHPBefore = hpCurrent;
        targetHPMax = hpMax;

        const newHP = Math.max(0, targetHPBefore - damage);
        targetHPAfter = newHP;
        targetDied = newHP <= 0;

        if (!runtime.vitals) runtime.vitals = { hp: { current: hpMax, max: hpMax } };
        if (!runtime.vitals.hp) runtime.vitals.hp = { current: hpMax, max: hpMax };
        runtime.vitals.hp.current = newHP;
        runtime.vitals.hp.max = hpMax;

        runtime.hpCurrent = newHP;
        runtime.hpMax = hpMax;
        if (runtime.combat) {
          runtime.combat.hpCurrent = newHP;
          runtime.combat.hpMax = hpMax;
        }
        if (runtime.stats) {
          runtime.stats.hpCurrent = newHP;
          runtime.stats.hpMax = hpMax;
        }

        markStatsDirty(targetId);
      } else {
        const stats = await db.GaUserStats.findByPk(targetId);
        if (stats) {
          targetHPBefore = Number(stats.hp_current);
          targetHPMax = Number(stats.hp_max);

          const newHP = Math.max(0, targetHPBefore - damage);
          targetHPAfter = newHP;
          targetDied = newHP <= 0;

          await stats.update({ hp_current: newHP });
        }
      }
    } else if (targetKind === "ENEMY") {
      const enemySlot = await db.GaSpawnInstanceEnemy.findByPk(targetId, {
        include: [
          {
            association: "spawnDefEnemy",
            required: true,
            include: [
              {
                association: "enemyDef",
                required: true,
                include: [
                  {
                    association: "baseStats",
                    required: true,
                    attributes: ["hp_max"],
                  },
                ],
              },
            ],
          },
        ],
      });
      if (enemySlot) {
        targetHPBefore = Number(enemySlot.hp_current);
        targetHPMax = Number(
          enemySlot.spawnDefEnemy?.enemyDef?.baseStats?.hp_max ?? enemySlot.hp_current
        );

        const newHP = Math.max(0, targetHPBefore - damage);
        targetHPAfter = newHP;

        await enemySlot.update({ hp_current: newHP });

        if (newHP <= 0) {
          await markEnemyDead(targetId, nowMs);
          targetDied = true;
        }

        console.log(
          `[COMBAT] Enemy ${targetId} took ${damage} damage (${targetHPBefore} -> ${targetHPAfter}) source=runtime`
        );
      }
    }
  } catch (err) {
    console.error("[COMBAT] Error applying damage:", err);
    return {
      ok: false,
      error: "DAMAGE_APPLY_FAILED",
      details: err.message,
    };
  }

  return {
    ok: true,
    damage: damage,
    targetHPBefore,
    targetHPAfter,
    targetHPMax,
    targetDied,
    cooldownMs,
    newCooldownStartMs: nowMs,
    staminaCost: staminaConsumption.staminaCost,
    staminaBefore: staminaConsumption.staminaBefore,
    staminaAfter: staminaConsumption.staminaAfter,
    staminaMax: staminaConsumption.staminaMax,
  };
}

module.exports = {
  executeAttack,
};
