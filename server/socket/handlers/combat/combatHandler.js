// server/socket/handlers/combat/combatHandler.js

/**
 * =====================================================================
 * COMBAT HANDLER - Socket Listeners
 * =====================================================================
 *
 * Responsabilidade:
 * - Ouvir eventos de combate do cliente ("combat:attack")
 * - Carregar dados do atacante e alvo
 * - Chamar combatSystem.executeAttack()
 * - Emitir resultado para clientes (damage, HP, morte)
 * - Colocar inimigo em modo COMBAT (se recebeu dano)
 *
 * Este arquivo ORQUESTRA o combate, mas não valida tudo
 * (validações pesadas ficam em combatSystem.js)
 *
 * =====================================================================
 */

const { getRuntime } = require("../../../state/runtimeStore");
const { getEnemiesForInstance } = require("../../../state/enemies/enemiesRuntimeStore");
const { executeAttack, loadPlayerCombatStats, loadEnemyCombatStats } = require("../../../service/combatSystem");

/**
 * =====================================================================
 * EVENT: Player tenta atacar um inimigo
 * =====================================================================
 *
 * Cliente envia: { targetId, targetKind }
 * Backend valida e executa ataque
 */
async function onCombatAttack(socket, io, payload) {
  try {
    const userId = socket.data.userId;
    if (!userId) {
      console.warn("[COMBAT] Socket sem userId");
      return socket.emit("combat:attack_result", {
        ok: false,
        error: "NOT_AUTHENTICATED"
      });
    }

    const { targetId, targetKind } = payload || {};

    // ===================================================================
    // 1. VALIDAÇÕES BÁSICAS
    // ===================================================================

    if (!targetId || !targetKind) {
      return socket.emit("combat:attack_result", {
        ok: false,
        error: "MISSING_TARGET"
      });
    }

    // ===================================================================
    // 2. CARREGAR DADOS DO ATACANTE (PLAYER)
    // ===================================================================

    const attackerRuntime = getRuntime(userId);
    if (!attackerRuntime) {
      return socket.emit("combat:attack_result", {
        ok: false,
        error: "ATTACKER_NOT_FOUND"
      });
    }

    // Instância deve ser a mesma
    const attackerInstanceId = attackerRuntime.instanceId;

    // Posição atual do atacante
    const attackerPos = {
      x: Number(attackerRuntime.pos?.x ?? 0),
      z: Number(attackerRuntime.pos?.z ?? 0)
    };

    // Carregar stats de combate do player
    const attackerStats = await loadPlayerCombatStats(userId);
    if (!attackerStats) {
      return socket.emit("combat:attack_result", {
        ok: false,
        error: "ATTACKER_STATS_NOT_FOUND"
      });
    }

    // Rastrear último ataque do player (para cooldown)
    if (!attackerRuntime._lastAttackAtMs) {
      attackerRuntime._lastAttackAtMs = 0;
    }

    // ===================================================================
    // 3. CARREGAR DADOS DO ALVO
    // ===================================================================

    let targetPos = null;
    let targetInstanceId = null;
    let targetStats = null;
    let targetDefense = 0;

    if (targetKind === "ENEMY") {
      // Procurar inimigo no store em memória
      const enemies = getEnemiesForInstance(attackerInstanceId);
      const targetEnemy = enemies.find(e => String(e.id) === String(targetId));

      if (!targetEnemy) {
        return socket.emit("combat:attack_result", {
          ok: false,
          error: "TARGET_NOT_FOUND"
        });
      }

      targetInstanceId = targetEnemy.instanceId;
      targetPos = {
        x: Number(targetEnemy.pos?.x ?? 0),
        z: Number(targetEnemy.pos?.z ?? 0)
      };

      // Carregar stats do inimigo
      targetStats = await loadEnemyCombatStats(targetId);
      if (!targetStats) {
        return socket.emit("combat:attack_result", {
          ok: false,
          error: "TARGET_STATS_NOT_FOUND"
        });
      }

      targetDefense = targetStats.defense || 0;

    } else if (targetKind === "PLAYER") {
      const targetRuntime = getRuntime(targetId);
      if (!targetRuntime) {
        return socket.emit("combat:attack_result", {
          ok: false,
          error: "TARGET_NOT_FOUND"
        });
      }

      targetInstanceId = targetRuntime.instanceId;
      targetPos = {
        x: Number(targetRuntime.pos?.x ?? 0),
        z: Number(targetRuntime.pos?.z ?? 0)
      };

      // Carregar stats do player alvo
      const targetPlayerStats = await loadPlayerCombatStats(targetId);
      targetStats = targetPlayerStats;
      targetDefense = targetPlayerStats?.defense || 0;

    } else {
      return socket.emit("combat:attack_result", {
        ok: false,
        error: "UNKNOWN_TARGET_KIND"
      });
    }

    // Instância deve ser a mesma
    if (targetInstanceId !== attackerInstanceId) {
      return socket.emit("combat:attack_result", {
        ok: false,
        error: "DIFFERENT_INSTANCE"
      });
    }

    // ===================================================================
    // 4. CHAMAR CORE DE COMBATE
    // ===================================================================

    const nowMs = Date.now();

    const combatResult = await executeAttack({
      attackerId: userId,
      attackerKind: "PLAYER",
      targetId: targetId,
      targetKind: targetKind,
      attackerPos: attackerPos,
      targetPos: targetPos,
      attackerAttackPower: attackerStats.attackPower,
      attackerAttackSpeed: attackerStats.attackSpeed,
      targetDefense: targetDefense,
      attackRange: attackerStats.attackRange,
      lastAttackAtMs: attackerRuntime._lastAttackAtMs,
      nowMs: nowMs
    });

    // ===================================================================
    // 5. PROCESSAR RESULTADO
    // ===================================================================

    if (!combatResult.ok) {
      // Ataque falhou (fora de range, cooldown, etc)
      return socket.emit("combat:attack_result", {
        ok: false,
        error: combatResult.error,
        details: combatResult
      });
    }

    // Ataque bem-sucedido!
    // Guardar timestamp do ataque para próximo cooldown
    attackerRuntime._lastAttackAtMs = nowMs;

    console.log(`[COMBAT] Player ${userId} attacked ${targetKind} ${targetId} for ${combatResult.damage} damage`);

    // ===================================================================
    // 6. COLOCAR INIMIGO EM MODO COMBAT (se foi alvo)
    // ===================================================================

    if (targetKind === "ENEMY") {
      const enemies = getEnemiesForInstance(attackerInstanceId);
      const targetEnemy = enemies.find(e => String(e.id) === String(targetId));

      if (targetEnemy) {
        // Marcar como em combate
        targetEnemy._combatMode = true;
        targetEnemy._combatTargetId = userId; // Inimigo vai perseguir/atacar este player
        targetEnemy._combatStartedAtMs = nowMs;

        console.log(`[COMBAT] Enemy ${targetId} entered COMBAT mode, targeting player ${userId}`);
      }
    }

    // ===================================================================
    // 7. EMITIR RESULTADO PARA CLIENTE
    // ===================================================================

    // Broadcast para todos na instância (todos veem o dano)
    io.to(`inst:${attackerInstanceId}`).emit("combat:damage_taken", {
      attackerId: userId,
      targetId: targetId,
      targetKind: targetKind,
      damage: combatResult.damage,
      targetHPBefore: combatResult.targetHPBefore,
      targetHPAfter: combatResult.targetHPAfter,
      targetHPMax: combatResult.targetHPMax,
      targetDied: combatResult.targetDied,
      timestamp: nowMs
    });

    // Responder ao atacante com resultado detalhado
    socket.emit("combat:attack_result", {
      ok: true,
      damage: combatResult.damage,
      targetHPAfter: combatResult.targetHPAfter,
      targetHPMax: combatResult.targetHPMax,
      targetDied: combatResult.targetDied,
      cooldownMs: combatResult.cooldownMs,
      newCooldownStartMs: combatResult.newCooldownStartMs
    });

    // ===================================================================
    // 8. HANDLE MORTE
    // ===================================================================

    if (combatResult.targetDied && targetKind === "ENEMY") {
      // Enemy morreu - pode fazer algo especial aqui depois
      // Por enquanto, só log
      console.log(`[COMBAT] Enemy ${targetId} died to player ${userId}`);
    }

  } catch (err) {
    console.error("[COMBAT] Exception in onCombatAttack:", err);
    socket.emit("combat:attack_result", {
      ok: false,
      error: "INTERNAL_ERROR"
    });
  }
}

/**
 * =====================================================================
 * EVENT: Player para de atacar (solta SPACE ou clica para se mover)
 * =====================================================================
 *
 * Pode ser usado para "cancelar" combate ou simplesmente desselecionar alvo
 * Por enquanto, apenas registra intenção
 */
async function onCombatStop(socket, io, payload) {
  try {
    const userId = socket.data.userId;
    if (!userId) return;

    const { targetId } = payload || {};

    if (!targetId) return;

    console.log(`[COMBAT] Player ${userId} stopped attacking target ${targetId}`);

    // Aqui você pode adicionar lógica de:
    // - Parar animação de ataque no frontend
    // - Desselecionar target
    // - Etc

  } catch (err) {
    console.error("[COMBAT] Exception in onCombatStop:", err);
  }
}

/**
 * =====================================================================
 * REGISTRAR LISTENERS
 * =====================================================================
 *
 * Chame isso no arquivo principal de socket setup
 */
function registerCombatHandlers(socket, io) {
  socket.on("combat:attack", (payload) => onCombatAttack(socket, io, payload));
  socket.on("combat:stop", (payload) => onCombatStop(socket, io, payload));

  console.log(`[COMBAT] Handlers registered for socket ${socket.id}`);
}

module.exports = {
  registerCombatHandlers,
  onCombatAttack,
  onCombatStop
};