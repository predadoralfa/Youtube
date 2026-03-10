// server/state/enemies/enemyAI.js

/**
 * =====================================================================
 * ENEMY AI - Comportamento do Inimigo
 * =====================================================================
 *
 * Responsabilidade:
 * - Gerenciar estado do inimigo (PASSIVE -> COMBAT -> IDLE)
 * - Perseguir player até 15 units de distância
 * - Auto-atacar quando dentro do range próprio
 * - Voltar ao idle quando player sai do range
 *
 * Executa no tick (50ms) como parte do loop principal
 *
 * Estados:
 * PASSIVE: inimigo patrulha normalmente (movimento aleatório)
 * COMBAT: inimigo levou dano, persegue e ataca
 * IDLE: inimigo parou de perseguir (player longe demais)
 *
 * =====================================================================
 */

const { getRuntime } = require("../runtimeStore");
const { executeAttack, loadEnemyCombatStats } = require("../../service/combatSystem");

/**
 * Limites de combate
 */
const COMBAT_RANGE_MAX = 15.0;        // Max 15 units de distância para perseguir
const COMBAT_TIMEOUT_MS = 30000;       // Timeout: se não atacar em 30s, volta ao idle

/**
 * Calcula distância entre dois pontos 2D
 */
function distance2D(x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  return Math.hypot(dx, dz);
}

/**
 * Normaliza um vetor 2D
 */
function normalize2D(x, z) {
  const len = Math.hypot(x, z);
  if (len <= 0.00001) return { x: 0, z: 0 };
  return { x: x / len, z: z / len };
}

/**
 * =====================================================================
 * Processa IA de um inimigo por tick
 * =====================================================================
 *
 * Chamado a cada 50ms pelo movimento tick
 * Retorna true se inimigo se moveu (para emitir delta)
 */
async function updateEnemyAI(enemy, nowMs, dt) {
  // Inimigos mortos não fazem nada
  if (enemy.status !== "ALIVE") {
    return false;
  }

  // ===================================================================
  // 1. VERIFICAR SE INIMIGO ESTÁ EM COMBATE
  // ===================================================================

  const inCombat = enemy._combatMode === true;
  const combatTargetId = enemy._combatTargetId;
  const combatStartedAt = enemy._combatStartedAtMs || 0;

  // Se está em combate, tentar perseguir e atacar
  if (inCombat && combatTargetId) {
    // Tentar encontrar target
    const targetRuntime = getRuntime(combatTargetId);

    if (!targetRuntime) {
      // Target não existe mais (desconectou?)
      endCombat(enemy);
      return false;
    }

    const targetPos = {
      x: Number(targetRuntime.pos?.x ?? 0),
      z: Number(targetRuntime.pos?.z ?? 0)
    };

    const enemyPos = enemy.pos;
    const dist = distance2D(enemyPos.x, enemyPos.z, targetPos.x, targetPos.z);

    // ===================================================================
    // 1A. VERIFICAR TIMEOUT (foi atacado, mas passou muito tempo)
    // ===================================================================

    const timeSinceCombatStart = nowMs - combatStartedAt;
    if (timeSinceCombatStart > COMBAT_TIMEOUT_MS) {
      console.log(`[ENEMY_AI] Enemy ${enemy.id} combat timeout - returning to idle`);
      endCombat(enemy);
      return false;
    }

    // ===================================================================
    // 1B. MUITO LONGE - PARAR PERSEGUIÇÃO
    // ===================================================================

    if (dist > COMBAT_RANGE_MAX) {
      console.log(`[ENEMY_AI] Enemy ${enemy.id} target too far (${dist.toFixed(1)} > ${COMBAT_RANGE_MAX}) - returning to idle`);
      endCombat(enemy);
      return false;
    }

    // ===================================================================
    // 1C. DENTRO DO RANGE - PERSEGUIR
    // ===================================================================

    if (dist > enemy.stats.moveSpeed * dt) {
      // Perseguir: calcular direção para target
      const dx = targetPos.x - enemyPos.x;
      const dz = targetPos.z - enemyPos.z;
      const dir = normalize2D(dx, dz);

      const speed = Number(enemy.stats?.moveSpeed) || 3.5;
      const newPosX = enemyPos.x + dir.x * speed * dt;
      const newPosZ = enemyPos.z + dir.z * speed * dt;

      // Atualizar posição
      enemy.pos = { x: newPosX, z: newPosZ };

      // Atualizar yaw (apontar para o alvo)
      const newYaw = Math.atan2(dx, dz);
      enemy.yaw = newYaw;

      enemy.action = "move";
      enemy.rev = (enemy.rev || 0) + 1;

      return true; // Moveu, emitir delta
    }

    // ===================================================================
    // 1D. PRÓXIMO O SUFICIENTE - TENTAR ATACAR
    // ===================================================================

    const enemyCombatStats = await loadEnemyCombatStats(enemy.id);
    if (!enemyCombatStats) {
      return false;
    }

    const attackRange = enemyCombatStats.attackRange || 1.2;

    if (dist <= attackRange) {
      // Dentro do range - tentar atacar
      const lastEnemyAttackMs = enemy._lastAttackAtMs || 0;

      const attackResult = await executeAttack({
        attackerId: enemy.id,
        attackerKind: "ENEMY",
        targetId: combatTargetId,
        targetKind: "PLAYER",
        attackerPos: enemyPos,
        targetPos: targetPos,
        attackerAttackPower: enemyCombatStats.attackPower,
        attackerAttackSpeed: enemyCombatStats.attackSpeed,
        targetDefense: 0, // TODO: carregar defesa do player
        attackRange: attackRange,
        lastAttackAtMs: lastEnemyAttackMs,
        nowMs: nowMs
      });

      if (attackResult.ok) {
        // Ataque bem-sucedido
        enemy._lastAttackAtMs = nowMs;

        console.log(`[ENEMY_AI] Enemy ${enemy.id} attacked player ${combatTargetId} for ${attackResult.damage} damage`);

        // Atualizar HP do inimigo no store (já foi atualizado no banco por combatSystem)
        // Aqui só marcamos como dirty para enviar delta
        enemy.action = "attack";
        enemy.rev = (enemy.rev || 0) + 1;

        return true; // Emitir estado de ataque
      } else {
        // Ataque falhou (cooldown, etc) - continuar
        return false;
      }
    }

    // Dentro do range mas não tão perto - mover mais perto
    return false;
  }

  // ===================================================================
  // 2. SEM COMBATE - COMPORTAMENTO PASSIVO (movimento aleatório)
  // ===================================================================

  // Já é tratado pelo enemyMovement.js
  // Aqui só garantimos que não tem flags de combate
  if (!inCombat) {
    enemy._combatMode = false;
    enemy._combatTargetId = null;
    enemy._combatStartedAtMs = null;
  }

  return false;
}

/**
 * =====================================================================
 * Terminar combate - voltar ao estado PASSIVE
 * =====================================================================
 */
function endCombat(enemy) {
  enemy._combatMode = false;
  enemy._combatTargetId = null;
  enemy._combatStartedAtMs = null;
  enemy._lastAttackAtMs = 0;
  enemy.action = "idle";
  // Movimento aleatório volta a funcionar (será tratado pelo enemyMovement.js)
}

/**
 * =====================================================================
 * Tick principal de IA - chamado para cada inimigo
 * =====================================================================
 */
async function tickEnemyAI(enemies, nowMs, dt) {
  const changedEnemies = [];

  for (const enemy of enemies) {
    try {
      const changed = await updateEnemyAI(enemy, nowMs, dt);
      if (changed) {
        changedEnemies.push(enemy);
      }
    } catch (err) {
      console.error(`[ENEMY_AI] Error updating enemy ${enemy?.id}:`, err);
    }
  }

  return changedEnemies;
}

module.exports = {
  tickEnemyAI,
  updateEnemyAI,
  endCombat,

  // Constantes (importáveis)
  COMBAT_RANGE_MAX,
  COMBAT_TIMEOUT_MS,

  // Internals
  _internal: {
    distance2D,
    normalize2D
  }
};