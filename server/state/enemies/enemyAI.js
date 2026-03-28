// server/state/enemies/enemyAI.js
// ✨ FINAL: Compatível com tickOnce.js - Função tickEnemyAI

const { getRuntime, markStatsDirty } = require("../runtimeStore");
const db = require("../../models");

const COMBAT_RANGE_LIMIT = 15; // Perseguir até 15 unidades
const ENEMY_ATTACK_COOLDOWN_MS = 1500; // 1.5s entre ataques
const ENEMY_ATTACK_RANGE = 1.2;

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function calculateDistance(p1, p2) {
  const dx = p1.x - p2.x;
  const dz = p1.z - p2.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function normalizeDirection(x, z) {
  const len = Math.sqrt(x * x + z * z);
  if (len === 0) return { x: 0, z: 0 };
  return { x: x / len, z: z / len };
}

/**
 * ✨ Volta inimigo ao spawn e limpa combate
 */
function resetEnemyToSpawn(enemy) {
  if (!enemy) return;

  const hadCombat = enemy._combatMode || enemy._combatActive;
  
  if (enemy._spawnPos) {
    enemy.pos = { ...enemy._spawnPos };
  }
  
  enemy._combatMode = false;
  enemy._combatActive = false;
  enemy._combatTargetId = null;
  enemy._moveTarget = null;
  enemy._moveTargetSetAt = null;
  enemy._combatStartedAtMs = null;
  enemy._lastAttackAtMs = 0;
  
  enemy.moveMode = "IDLE";
  enemy.moveTarget = null;
  enemy.moveStopRadius = null;

  // Log apenas se estava em combate
  if (hadCombat) {
    console.log(`[ENEMY_AI] 🔄 Enemy ${enemy.id} resetado ao spawn`);
  }
}

/**
 * ✨ Atualizar IA de um inimigo
 * Retorna: true se o inimigo mudou de estado/posição
 */
function updateSingleEnemyAI(enemy, nowMs) {
  if (!enemy || !enemy.pos || String(enemy.status) !== "ALIVE") {
    return false;
  }

  const prevMoveMode = enemy.moveMode;
  let changed = false;

  // ==========================================
  // CASO 1: Inimigo congelado
  // (Esperando 1º ataque após click+SPACE)
  // ==========================================
  if (enemy._combatMode === true && enemy._combatActive === false) {
    if (enemy.moveMode !== "IDLE") {
      enemy.moveMode = "IDLE";
      enemy.moveTarget = null;
      enemy.moveStopRadius = null;
      changed = true;
      console.log(`[ENEMY_AI] ❄️ Enemy ${enemy.id} CONGELADO (esperando 1º ataque)`);
    }
    return changed;
  }

  // ==========================================
  // CASO 2: Inimigo em combate ativo
  // (Perseguir e atacar)
  // ==========================================
  if (enemy._combatMode === true && enemy._combatActive === true) {
    const targetId = enemy._combatTargetId;
    if (!targetId) {
      console.log(`[ENEMY_AI] ⚠️ Enemy ${enemy.id} em combate mas sem target`);
      resetEnemyToSpawn(enemy);
      return true;
    }

    const targetRt = getRuntime(String(targetId));
    if (!targetRt) {
      console.log(`[ENEMY_AI] ⚠️ Enemy ${enemy.id} target desconectou`);
      resetEnemyToSpawn(enemy);
      return true;
    }

    const targetPos = targetRt.pos;
    if (!targetPos || !isFiniteNumber(targetPos.x) || !isFiniteNumber(targetPos.z)) {
      console.log(`[ENEMY_AI] ⚠️ Enemy ${enemy.id} posição target inválida`);
      resetEnemyToSpawn(enemy);
      return true;
    }

    // Calcular distância
    const dist = calculateDistance(enemy.pos, targetPos);

    // ✨ Se muito longe, voltar ao spawn
    if (dist > COMBAT_RANGE_LIMIT) {
      console.log(`[ENEMY_AI] 📍 Enemy ${enemy.id} escapou (${dist.toFixed(1)} > ${COMBAT_RANGE_LIMIT}), resetando`);
      resetEnemyToSpawn(enemy);
      return true;
    }

    // ✨ Se estiver dentro do range de ataque, para pra bater
    if (dist <= ENEMY_ATTACK_RANGE) {
      enemy._moveTarget = null;
      if (enemy.moveMode !== "IDLE") {
        enemy.moveMode = "IDLE";
        enemy.moveTarget = null;
        enemy.moveStopRadius = null;
        changed = true;
        console.log(`[ENEMY_AI] ⚔️ Enemy ${enemy.id} parou para atacar`);
      }
      return changed;
    }

    // Perseguir: definir alvo e deixar movimento processar
    const newMoveMode = "FOLLOW";
    if (prevMoveMode !== newMoveMode) {
      console.log(`[ENEMY_AI] 🔥 Enemy ${enemy.id} perseguindo player ${targetId}`);
      changed = true;
    }

    enemy.moveMode = newMoveMode;
    enemy.moveTarget = { x: targetPos.x, z: targetPos.z };
    enemy.moveStopRadius = ENEMY_ATTACK_RANGE;
    enemy.moveTickAtMs = nowMs;
    enemy._moveTarget = { x: targetPos.x, z: targetPos.z };
    enemy._moveTargetSetAt = nowMs;

    return changed;
  }

  // ==========================================
  // CASO 3: Normal (patrulha / idle)
  // ==========================================
  if (enemy.moveMode !== "IDLE") {
    enemy.moveMode = "IDLE";
    enemy.moveTarget = null;
    enemy.moveStopRadius = null;
    changed = true;
  }

  return changed;
}

/**
 * ✨ Processar ataques automáticos de um inimigo
 * Retorna: null ou { enemyId, targetId, damage, ... }
 */
async function updateSingleEnemyAttack(enemy, nowMs) {
  if (!enemy) return null;
  if (!enemy._combatActive) return null;
  if (!enemy._combatTargetId) return null;
  if (String(enemy.status) !== "ALIVE") return null;

  const targetId = String(enemy._combatTargetId);
  const targetRt = getRuntime(targetId);
  if (!targetRt) {
    // Target desconectou, limpar
    resetEnemyToSpawn(enemy);
    return null;
  }

  // Validar posições
  if (!enemy.pos || !targetRt.pos) return null;
  if (!isFiniteNumber(enemy.pos.x) || !isFiniteNumber(enemy.pos.z)) return null;
  if (!isFiniteNumber(targetRt.pos.x) || !isFiniteNumber(targetRt.pos.z)) return null;

  // Verificar cooldown
  const lastAttackMs = enemy._lastAttackAtMs ?? 0;
  if (nowMs - lastAttackMs < ENEMY_ATTACK_COOLDOWN_MS) {
    return null;
  }

  // Verificar distância
  const dist = calculateDistance(enemy.pos, targetRt.pos);
  const attackRange = ENEMY_ATTACK_RANGE;

  if (dist > attackRange) {
    // Longe demais, não ataca
    return null;
  }

  // ✨ ACERTO! Inimigo ataca player
  
  // Calcular dano: attackPower autoritativo do enemy - defense do player
  const enemyAttackPower =
    Number.isFinite(Number(enemy.attackPower))
      ? Number(enemy.attackPower)
      : Number.isFinite(Number(enemy.stats?.attackPower))
        ? Number(enemy.stats.attackPower)
        : 5;
  const playerDefense = targetRt._defense || 0;
  const damage = Math.max(1, enemyAttackPower - playerDefense);

  console.log(
    `[ENEMY_AI] 🔥 Enemy ${enemy.id} ataca player ${targetId} com ${damage} dano (attackPower=${enemyAttackPower})`
  );

  // Aplicar dano ao player
  if (!targetRt.vitals) {
    targetRt.vitals = { hp: { current: 100, max: 100 } };
  }
  if (!targetRt.vitals.hp) {
    targetRt.vitals.hp = { current: 100, max: 100 };
  }

  const hpBefore = targetRt.vitals.hp.current;
  targetRt.vitals.hp.current = Math.max(0, hpBefore - damage);
  const hpAfter = targetRt.vitals.hp.current;
  const hpMax = targetRt.vitals.hp.max;

  if (targetRt) {
    targetRt.hpCurrent = hpAfter;
    targetRt.hpMax = hpMax;
    if (targetRt.combat) {
      targetRt.combat.hpCurrent = hpAfter;
      targetRt.combat.hpMax = hpMax;
    }
    if (targetRt.stats) {
      targetRt.stats.hpCurrent = hpAfter;
      targetRt.stats.hpMax = hpMax;
    }
    markStatsDirty(targetId, nowMs);
  } else {
    try {
      const playerStatsRow = await db.GaUserStats.findByPk(Number(targetId));
      if (playerStatsRow) {
        await playerStatsRow.update({ hp_current: hpAfter, hp_max: hpMax });
      }
    } catch (err) {
      console.error(`[ENEMY_AI] Failed to persist player hp for player=${targetId}:`, err);
    }
  }

  // Atualizar cooldown
  enemy._lastAttackAtMs = nowMs;

  // Retornar resultado para broadcast
  return {
    enemyId: enemy.id,
    targetId: String(targetId),
    attackPower: enemyAttackPower,
    damage,
    targetHPBefore: hpBefore,
    targetHPAfter: hpAfter,
    targetHPMax: hpMax,
    targetDied: hpAfter <= 0,
  };
}

/**
 * ✨ FUNÇÃO PRINCIPAL: Processar IA de todos os inimigos
 * Chamado por tickOnce.js
 * 
 * @param {Array} enemies - Lista de inimigos da instância
 * @param {number} t - Timestamp atual
 * @param {number} dt - Delta time em segundos
 * 
 * @returns {Array} Lista de inimigos que mudaram
 */
async function tickEnemyAI(enemies, t, dt) {
  if (!enemies || !Array.isArray(enemies)) {
    return [];
  }

  const changedEnemies = [];
  const attacks = [];

  for (const enemy of enemies) {
    if (!enemy || String(enemy.status) !== "ALIVE") {
      continue;
    }

    // Atualizar IA
    const aiChanged = updateSingleEnemyAI(enemy, t);
    if (aiChanged) {
      changedEnemies.push(enemy);
    }

    // Processar ataques
    const attackResult = await updateSingleEnemyAttack(enemy, t);
    if (attackResult) {
      attacks.push(attackResult);
      // Inimigo que atacou também mudou
      if (!changedEnemies.includes(enemy)) {
        changedEnemies.push(enemy);
      }
    }
  }

  // Armazenar ataques para later broadcast (se necessário)
  // Pode ser acessado via getLastEnemyAttacks()
  enemies._lastTickAttacks = attacks.length > 0 ? attacks : [];

  return changedEnemies;
}

/**
 * ✨ Obter ataques da última execução (para broadcast)
 */
function getLastTickAttacks(enemies) {
  if (!enemies || !Array.isArray(enemies)) {
    return [];
  }
  const attacks = enemies._lastTickAttacks || [];
  enemies._lastTickAttacks = [];
  return attacks;
}

module.exports = {
  tickEnemyAI,
  getLastTickAttacks,
  updateSingleEnemyAI,
  updateSingleEnemyAttack,
  resetEnemyToSpawn,
  COMBAT_RANGE_LIMIT,
  ENEMY_ATTACK_COOLDOWN_MS,
};
