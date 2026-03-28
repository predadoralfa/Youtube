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

/**
 * =====================================================================
 * Carregar stats de combate do PLAYER
 * =====================================================================
 */
async function loadPlayerCombatStats(userId) {
  try {
    const stats = await db.GaUserStats.findByPk(userId, {
      attributes: [
        "hp_current",
        "hp_max",
        "attack_power",
        "defense",
        "attack_speed",
        "move_speed",
        "attack_range"  // ✨ NOVO CAMPO (ver se existe no banco)
      ]
    });

    if (!stats) return null;

    return {
      hpCurrent: Number(stats.hp_current),
      hpMax: Number(stats.hp_max),
      attackPower: Number(stats.attack_power),
      defense: Number(stats.defense),
      attackSpeed: Number(stats.attack_speed),
      moveSpeed: Number(stats.move_speed),
      attackRange: Number(stats.attack_range || 2.5)  // Default 2.5 se não tiver
    };
  } catch (err) {
    console.error(`[COMBAT] Error loading player stats for ${userId}:`, err);
    return null;
  }
}

/**
 * =====================================================================
 * Carregar stats de combate do ENEMY
 * =====================================================================
 */
async function loadEnemyCombatStats(enemyInstanceId) {
  try {
    const stats = await db.GaEnemyInstanceStats.findByPk(enemyInstanceId, {
      attributes: [
        "hp_current",
        "hp_max",
        "attack_speed",
        "move_speed"
      ]
    });

    if (!stats) return null;

    return {
      hpCurrent: Number(stats.hp_current),
      hpMax: Number(stats.hp_max),
      defense: 0,
      attackSpeed: Number(stats.attack_speed),
      moveSpeed: Number(stats.move_speed),
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

  // attack_speed = 1.0 significa 1 ataque por segundo
  // cooldown em ms = 1000 / attack_speed
  const cooldownMs = 1000 / attackerAttackSpeed;
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

  // Damage = attack_power - defense (min 1)
  const baseDamage = Math.max(1, attackerAttackPower - targetDefense);

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
      // Atualizar HP do player no banco
      const stats = await db.GaUserStats.findByPk(targetId);
      if (stats) {
        targetHPBefore = Number(stats.hp_current);
        targetHPMax = Number(stats.hp_max);

        const newHP = Math.max(0, targetHPBefore - damage);
        targetHPAfter = newHP;

        await stats.update({ hp_current: newHP });

        targetDied = newHP <= 0;

        console.log(`[COMBAT] Player ${targetId} took ${damage} damage (${targetHPBefore} -> ${targetHPAfter})`);
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
          await db.GaEnemyInstance.update(
            { status: "DEAD", dead_at: new Date() },
            { where: { id: targetId } }
          );
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
    newCooldownStartMs: nowMs
  };
}

module.exports = {
  loadPlayerCombatStats,
  loadEnemyCombatStats,
  executeAttack
};
