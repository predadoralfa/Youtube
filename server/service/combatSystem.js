// server/service/combatSystem.js

/**
 * =====================================================================
 * COMBAT SYSTEM - Core Unitário
 * =====================================================================
 *
 * Responsabilidade:
 * - Validar se um ataque é legal (range, cooldown, alvo vivo, etc)
 * - Calcular dano (attack_power - defense)
 * - Aplicar dano no alvo (reduzir HP)
 * - Detectar morte
 * - Retornar resultado completo do ataque
 *
 * Servidor é AUTORIDADE: Cliente nunca calcula dano, sempre pede validação.
 *
 * Fluxo:
 * 1. Player clica em inimigo + aperta SPACE (ou evento de ataque)
 * 2. Frontend envia "combat:attack" com { targetId, targetKind }
 * 3. Backend (aqui) valida tudo
 * 4. Se valid: aplica dano, retorna resultado
 * 5. Se invalid: rejeita com motivo
 * 6. Frontend renderiza dano flutuante + atualiza HP bars
 *
 * =====================================================================
 */

const db = require("../models");

/**
 * Helpers de validação
 */
function toPositiveNumber(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function toUInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

/**
 * Calcula distância entre dois pontos 2D
 */
function distance2D(x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  return Math.hypot(dx, dz);
}

/**
 * =====================================================================
 * CORE: Validar + Executar um ataque
 * =====================================================================
 *
 * Retorna:
 * {
 *   ok: boolean,
 *   error?: string,
 *   damage?: number,
 *   targetDied?: boolean,
 *   targetHPBefore?: number,
 *   targetHPAfter?: number
 * }
 */
async function executeAttack({
  attackerId,           // ID do atacante (player)
  attackerKind,         // "PLAYER" | "ENEMY"
  targetId,             // ID do alvo
  targetKind,           // "ENEMY" | "PLAYER"
  attackerPos,          // { x, z } posição atual do atacante
  targetPos,            // { x, z } posição atual do alvo
  attackerAttackPower,  // attack_power do atacante
  attackerAttackSpeed,  // attack_speed (para cooldown)
  targetDefense,        // defense do alvo
  attackRange,          // range do ataque (1.0 para player melee)
  lastAttackAtMs,       // timestamp do último ataque do atacante
  nowMs                 // timestamp atual
}) {
  // ===================================================================
  // 1. VALIDAÇÕES DE ENTIDADE
  // ===================================================================

  if (!attackerId || !targetId) {
    return { ok: false, error: "MISSING_ID" };
  }

  if (!Number.isFinite(attackerPos?.x) || !Number.isFinite(attackerPos?.z)) {
    return { ok: false, error: "INVALID_ATTACKER_POS" };
  }

  if (!Number.isFinite(targetPos?.x) || !Number.isFinite(targetPos?.z)) {
    return { ok: false, error: "INVALID_TARGET_POS" };
  }

  // ===================================================================
  // 2. VALIDAÇÃO DE RANGE
  // ===================================================================

  const dist = distance2D(attackerPos.x, attackerPos.z, targetPos.x, targetPos.z);
  const effectiveRange = toPositiveNumber(attackRange, 1.0);

  if (dist > effectiveRange) {
    return {
      ok: false,
      error: "OUT_OF_RANGE",
      distance: dist,
      range: effectiveRange
    };
  }

  // ===================================================================
  // 3. VALIDAÇÃO DE COOLDOWN (attack_speed)
  // ===================================================================

  const attackSpeed = toPositiveNumber(attackerAttackSpeed, 1.0);
  const cooldownMs = 1000 / attackSpeed; // ex: speed 2.0 = 500ms cooldown

  const lastAttack = toUInt(lastAttackAtMs, 0);
  const timeSinceLastAttack = nowMs - lastAttack;

  if (lastAttack > 0 && timeSinceLastAttack < cooldownMs) {
    return {
      ok: false,
      error: "ON_COOLDOWN",
      cooldownMs,
      timeSinceLastAttack,
      timeRemaining: cooldownMs - timeSinceLastAttack
    };
  }

  // ===================================================================
  // 4. VALIDAÇÃO DE ALVO (target deve estar vivo)
  // ===================================================================

  let target = null;
  let targetHPBefore = 0;
  let targetHPMax = 0;

  if (targetKind === "ENEMY") {
    target = await db.GaEnemyInstance.findByPk(targetId, {
      include: ["stats"]
    });

    if (!target) {
      return { ok: false, error: "TARGET_NOT_FOUND" };
    }

    if (target.status !== "ALIVE") {
      return { ok: false, error: "TARGET_NOT_ALIVE", status: target.status };
    }

    const stats = target.stats;
    if (!stats) {
      return { ok: false, error: "TARGET_STATS_NOT_FOUND" };
    }

    targetHPBefore = toUInt(stats.hp_current, 0);
    targetHPMax = toUInt(stats.hp_max, 100);

  } else if (targetKind === "PLAYER") {
    const playerUser = await db.GaUser.findByPk(targetId);
    if (!playerUser || playerUser.status !== "ONLINE") {
      return { ok: false, error: "TARGET_NOT_FOUND" };
    }

    const playerStats = await db.GaUserStats.findByPk(targetId);
    if (!playerStats) {
      return { ok: false, error: "TARGET_STATS_NOT_FOUND" };
    }

    targetHPBefore = toUInt(playerStats.hp_current, 100);
    targetHPMax = toUInt(playerStats.hp_max, 100);

  } else {
    return { ok: false, error: "UNKNOWN_TARGET_KIND" };
  }

  if (targetHPBefore <= 0) {
    return { ok: false, error: "TARGET_ALREADY_DEAD" };
  }

  // ===================================================================
  // 5. CALCULAR DANO
  // ===================================================================

  const attackPower = toUInt(attackerAttackPower, 10);
  const defense = toUInt(targetDefense, 0);

  // Fórmula: dano = attack_power - defense, mínimo 1
  let damage = Math.max(1, attackPower - defense);

  // ===================================================================
  // 6. APLICAR DANO
  // ===================================================================

  const targetHPAfter = Math.max(0, targetHPBefore - damage);
  const targetDied = targetHPAfter <= 0;

  // Atualizar no banco
  if (targetKind === "ENEMY" && target) {
    target.stats.hp_current = targetHPAfter;
    
    if (targetDied) {
      target.status = "DEAD";
      target.dead_at = new Date();
    }

    await target.stats.save();
    await target.save();

  } else if (targetKind === "PLAYER") {
    const playerStats = await db.GaUserStats.findByPk(targetId);
    if (playerStats) {
      playerStats.hp_current = targetHPAfter;
      await playerStats.save();
    }

    // Se player morreu, pode fazer algo (game over, respawn, etc)
    if (targetDied) {
      console.log("[COMBAT] Player morreu:", targetId);
      // TODO: Implementar morte do player mais tarde
    }
  }

  // ===================================================================
  // 7. RETORNAR RESULTADO
  // ===================================================================

  return {
    ok: true,
    damage,
    targetHPBefore,
    targetHPAfter,
    targetHPMax,
    targetDied,
    cooldownMs,
    newCooldownStartMs: nowMs // Frontend sabe quando começar countdown de novo
  };
}

/**
 * =====================================================================
 * Carregar stats de ataque de um player
 * =====================================================================
 *
 * Retorna objeto com tudo que precisa para fazer ataque
 */
async function loadPlayerCombatStats(userId) {
  const stats = await db.GaUserStats.findByPk(userId);

  if (!stats) {
    return {
      attackPower: 10,
      defense: 0,
      attackSpeed: 1.0,
      attackRange: 1.0 // TODO: depois será dinâmico (arma, skills, etc)
    };
  }

  return {
    attackPower: toUInt(stats.attack_power, 10),
    defense: toUInt(stats.defense, 0),
    attackSpeed: toPositiveNumber(stats.attack_speed, 1.0),
    attackRange: 1.0 // Por enquanto fixo, depois dinamico
  };
}

/**
 * =====================================================================
 * Carregar stats de ataque de um inimigo
 * =====================================================================
 *
 * Retorna objeto com tudo que precisa para fazer ataque
 */
async function loadEnemyCombatStats(enemyInstanceId) {
  const enemyInstance = await db.GaEnemyInstance.findByPk(enemyInstanceId, {
    include: [
      {
        association: "definition",
        include: ["baseStats"]
      },
      "stats"
    ]
  });

  if (!enemyInstance) {
    return null;
  }

  const defStats = enemyInstance.definition?.baseStats;
  const instStats = enemyInstance.stats;

  if (!defStats || !instStats) {
    return null;
  }

  // Para inimigos, attack_power vem do template
  // TODO: depois fazer isso dinâmico (drops, evoluções, etc)
  const attackPower = toUInt(defStats.attack_power || 5, 5);
  const defense = toUInt(defStats.defense || 0, 0);
  const attackSpeed = toPositiveNumber(defStats.attack_speed, 1.0);
  const attackRange = toPositiveNumber(defStats.attack_range, 1.2);

  return {
    attackPower,
    defense,
    attackSpeed,
    attackRange
  };
}

module.exports = {
  executeAttack,
  loadPlayerCombatStats,
  loadEnemyCombatStats,

  // Internals para testes
  _internal: {
    distance2D,
    toPositiveNumber,
    toUInt
  }
};