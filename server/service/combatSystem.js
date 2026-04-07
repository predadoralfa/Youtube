// server/service/combatSystem.js

/**
 * =====================================================================
 * COMBAT SYSTEM - Core de Combate
 * =====================================================================
 *
 * Responsabilidade:
 * - Carregar stats de combate (player/enemy)
 * - Validar ataque (distância, cooldown)
 * - Calcular dano
 * - Aplicar dano (desconta HP)
 * - Determinar morte
 *
 * Este arquivo é o "source of truth" de combate
 * Qualquer lógica de dano, critério, buffs, etc vai aqui
 *
 * =====================================================================
 */

const db = require("../models");
const { getRuntime, markStatsDirty } = require("../state/runtimeStore");
const { loadPlayerCombatStats: loadStrictPlayerCombatStats } = require("../state/runtime/combatLoader");
const { markEnemyDead } = require("./enemyRespawnService");
const {
  COMBAT_BASE_COOLDOWN_MS,
  MELEE_ATTACK_STAMINA_COST,
  RANGED_ATTACK_STAMINA_COST,
  RANGED_ATTACK_MIN_RANGE,
} = require("../config/combatConstants");
const {
  readRuntimeStaminaCurrent,
  readRuntimeStaminaMax,
  syncRuntimeStamina,
} = require("../state/movement/stamina");

/**
 * =====================================================================
 * Carregar stats de combate do PLAYER
 * =====================================================================
 */
async function loadPlayerCombatStats(userId) {
  return loadStrictPlayerCombatStats(userId);
}

function resolveAttackStaminaCost(attackRange) {
  const range = Number(attackRange);
  if (Number.isFinite(range) && range > RANGED_ATTACK_MIN_RANGE) {
    return RANGED_ATTACK_STAMINA_COST;
  }
  return MELEE_ATTACK_STAMINA_COST;
}

async function consumeAttackerStamina(attackerId, attackerKind, attackRange) {
  if (attackerKind !== "PLAYER") {
    return {
      ok: true,
      staminaCost: 0,
      staminaBefore: null,
      staminaAfter: null,
      staminaMax: null,
    };
  }

  const staminaCost = resolveAttackStaminaCost(attackRange);
  const runtime = getRuntime(attackerId);

  if (runtime) {
    const staminaBefore = readRuntimeStaminaCurrent(runtime);
    const staminaMax = readRuntimeStaminaMax(runtime);

    if (staminaBefore < staminaCost) {
      return {
        ok: false,
        error: "INSUFFICIENT_STAMINA",
        staminaCost,
        staminaBefore,
        staminaAfter: staminaBefore,
        staminaMax,
      };
    }

    const staminaAfter = Math.max(0, staminaBefore - staminaCost);
    syncRuntimeStamina(runtime, staminaAfter, staminaMax);
    markStatsDirty(attackerId);

    return {
      ok: true,
      staminaCost,
      staminaBefore,
      staminaAfter,
      staminaMax,
    };
  }

  const stats = await db.GaUserStats.findByPk(attackerId);
  if (!stats) {
    return {
      ok: false,
      error: "ATTACKER_STATS_NOT_FOUND",
      staminaCost,
      staminaBefore: 0,
      staminaAfter: 0,
      staminaMax: 0,
    };
  }

  const staminaBefore = Number(stats.stamina_current ?? 0);
  const staminaMax = Number(stats.stamina_max ?? 0);

  if (staminaBefore < staminaCost) {
    return {
      ok: false,
      error: "INSUFFICIENT_STAMINA",
      staminaCost,
      staminaBefore,
      staminaAfter: staminaBefore,
      staminaMax,
    };
  }

  const staminaAfter = Math.max(0, staminaBefore - staminaCost);
  await stats.update({ stamina_current: staminaAfter });

  return {
    ok: true,
    staminaCost,
    staminaBefore,
    staminaAfter,
    staminaMax,
  };
}

/**
 * =====================================================================
 * Carregar stats de combate do ENEMY
 * =====================================================================
 */
async function loadEnemyCombatStats(enemyInstanceId) {
  try {
    const enemyInstance = await db.GaEnemyInstance.findByPk(enemyInstanceId, {
      include: [
        {
          association: "stats",
          required: true,
          attributes: [
            "hp_current",
            "hp_max",
            "attack_speed",
            "move_speed",
          ],
        },
        {
          association: "enemyDef",
          required: true,
          attributes: ["id"],
          include: [
            {
              association: "baseStats",
              required: true,
              attributes: [
                "hp_max",
                "move_speed",
                "attack_speed",
                "attack_power",
                "defense",
                "attack_range",
              ],
            },
          ],
        },
      ],
    });

    const stats = enemyInstance?.stats;
    const baseStats = enemyInstance?.enemyDef?.baseStats;
    if (!stats || !baseStats) return null;

    return {
      hpCurrent: Number(stats.hp_current),
      hpMax: Number(stats.hp_max),
      attackSpeed: Number(stats.attack_speed),
      moveSpeed: Number(stats.move_speed),
      attackPower: Number(baseStats.attack_power),
      defense: Number(baseStats.defense),
      attackRange: Number(baseStats.attack_range),
    };
  } catch (err) {
    console.error(`[COMBAT] Error loading enemy stats for ${enemyInstanceId}:`, err);
    return null;
  }
}

/**
 * =====================================================================
 * EXECUTAR ATAQUE - Core da lógica de combate
 * =====================================================================
 *
 * Validações:
 * - Distância dentro do range
 * - Cooldown respeitado
 * - Dano calculado
 * - HP atualizado
 *
 * Retorna:
 * {
 *   ok: boolean,
 *   damage: number,
 *   targetHPBefore: number,
 *   targetHPAfter: number,
 *   targetHPMax: number,
 *   targetDied: boolean,
 *   cooldownMs: number,
 *   newCooldownStartMs: number,
 *   error?: string
 * }
 */
async function executeAttack(params) {
  const {
    attackerId,
    attackerKind,      // "PLAYER" or "ENEMY"
    targetId,
    targetKind,        // "PLAYER" or "ENEMY"
    attackerPos,       // { x, z }
    targetPos,         // { x, z }
    attackerAttackPower,
    attackerAttackSpeed,
    targetDefense,
    attackRange,
    lastAttackAtMs,
    nowMs
  } = params;

  // ===================================================================
  // 1. VALIDAR DISTÂNCIA
  // ===================================================================

  const dx = targetPos.x - attackerPos.x;
  const dz = targetPos.z - attackerPos.z;
  const dist = Math.hypot(dx, dz);

  if (dist > attackRange) {
    return {
      ok: false,
      error: "OUT_OF_RANGE",
      distance: dist,
      attackRange: attackRange
    };
  }

  // ===================================================================
  // 2. VALIDAR COOLDOWN (attack_speed)
  // ===================================================================

  // attack_speed = 1.0 significa 1 ataque a cada 5 segundos nesta escala
  // cooldown em ms = COMBAT_BASE_COOLDOWN_MS / attack_speed
  const cooldownMs = COMBAT_BASE_COOLDOWN_MS / attackerAttackSpeed;
  const timeSinceLastAttack = nowMs - lastAttackAtMs;

  if (timeSinceLastAttack < cooldownMs) {
    return {
      ok: false,
      error: "ON_COOLDOWN",
      cooldownRemaining: cooldownMs - timeSinceLastAttack,
      cooldownTotal: cooldownMs
    };
  }

  // ===================================================================
  // 3. CALCULAR DANO (SIMPLES POR ENQUANTO)
  // ===================================================================

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

  // Damage = attack_power - defense (min 0)
  const baseDamage = Math.max(0, attackerAttackPower - targetDefense);

  // TODO: Adicionar crítico, buff, debuff, etc aqui depois
  const damage = baseDamage;

  // ===================================================================
  // 4. APLICAR DANO AO ALVO
  // ===================================================================

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
        // Fallback legado: persiste direto quando runtime não estiver carregado.
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
      // Atualizar HP do enemy no banco
      const stats = await db.GaEnemyInstanceStats.findByPk(targetId);
      if (stats) {
        targetHPBefore = Number(stats.hp_current);
        targetHPMax = Number(stats.hp_max);

        const newHP = Math.max(0, targetHPBefore - damage);
        targetHPAfter = newHP;

        await stats.update({ hp_current: newHP });

        // Marcar inimigo como morto se HP = 0
        if (newHP <= 0) {
          await markEnemyDead(targetId, nowMs);
          targetDied = true;
        }

        console.log(`[COMBAT] Enemy ${targetId} took ${damage} damage (${targetHPBefore} -> ${targetHPAfter})`);
      }
    }
  } catch (err) {
    console.error(`[COMBAT] Error applying damage:`, err);
    return {
      ok: false,
      error: "DAMAGE_APPLY_FAILED",
      details: err.message
    };
  }

  // ===================================================================
  // 5. RETORNAR RESULTADO
  // ===================================================================

  return {
    ok: true,
    damage: damage,
    targetHPBefore: targetHPBefore,
    targetHPAfter: targetHPAfter,
    targetHPMax: targetHPMax,
    targetDied: targetDied,
    cooldownMs: cooldownMs,
    newCooldownStartMs: nowMs,
    staminaCost: staminaConsumption.staminaCost,
    staminaBefore: staminaConsumption.staminaBefore,
    staminaAfter: staminaConsumption.staminaAfter,
    staminaMax: staminaConsumption.staminaMax,
  };
}

module.exports = {
  loadPlayerCombatStats,
  loadEnemyCombatStats,
  executeAttack,
  resolveAttackStaminaCost,
};
