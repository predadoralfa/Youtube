// server/socket/handlers/combat/combatHandler.js
// ✨ COMPLETO E CORRIGIDO: Validação de instanceId, cooldown, IA integrada

const { getRuntime } = require("../../../state/runtimeStore");
const { getEnemiesForInstance } = require("../../../state/enemies/enemiesRuntimeStore");
const { executeAttack, loadPlayerCombatStats, loadEnemyCombatStats } = require("../../../service/combatSystem");
const { createLootContainerForEnemy } = require("../../../service/lootService");
const { COMBAT_BASE_COOLDOWN_MS } = require("../../../config/combatConstants");

/**
 * =====================================================================
 * EVENT: Player tenta atacar um inimigo
 * =====================================================================
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
      console.log("[COMBAT] ❌ Payload inválido", { targetId, targetKind });
      return socket.emit("combat:attack_result", {
        ok: false,
        error: "MISSING_TARGET"
      });
    }

    console.log(`\n[COMBAT] ==================== ATTACK ATTEMPT ====================`);
    console.log(`[COMBAT] Player ${userId} → ${targetKind} ${targetId}`);

    // ===================================================================
    // 2. CARREGAR DADOS DO ATACANTE (PLAYER)
    // ===================================================================

    console.log(`[COMBAT] 1. Carregando dados do atacante...`);

    const attackerRuntime = getRuntime(userId);
    if (!attackerRuntime) {
      console.warn(`[COMBAT] ❌ Runtime do atacante não encontrado: ${userId}`);
      return socket.emit("combat:attack_result", {
        ok: false,
        error: "ATTACKER_NOT_FOUND"
      });
    }

    const attackerInstanceId = String(attackerRuntime.instanceId ?? "");
    console.log(`[COMBAT] ✅ Runtime encontrado, instanceId=${attackerInstanceId}`);

    const attackerPos = {
      x: Number(attackerRuntime.pos?.x ?? 0),
      z: Number(attackerRuntime.pos?.z ?? 0)
    };

    const attackerStats = await loadPlayerCombatStats(userId);
    if (!attackerStats) {
      console.warn(`[COMBAT] ❌ Stats do atacante não encontrados: ${userId}`);
      return socket.emit("combat:attack_result", {
        ok: false,
        error: "ATTACKER_STATS_NOT_FOUND"
      });
    }

    if (!attackerRuntime._lastAttackAtMs) {
      attackerRuntime._lastAttackAtMs = 0;
    }

    console.log(`[COMBAT] ✅ Atacante carregado:`);
    console.log(`[COMBAT]   Pos: (${attackerPos.x.toFixed(2)}, ${attackerPos.z.toFixed(2)})`);
    console.log(`[COMBAT]   AttackPower: ${attackerStats.attackPower}`);
    console.log(`[COMBAT]   AttackSpeed: ${attackerStats.attackSpeed}`);
    console.log(`[COMBAT]   AttackRange: ${attackerStats.attackRange}`);

    // ===================================================================
    // 3. VALIDAR COOLDOWN DO PLAYER
    // ===================================================================

    console.log(`[COMBAT] 2. Verificando cooldown...`);

    const nowMs = Date.now();
    const lastAttackMs = attackerRuntime._lastAttackAtMs ?? 0;
    const cooldownMs = COMBAT_BASE_COOLDOWN_MS / (attackerStats.attackSpeed || 1);
    const timeSinceLastAttack = nowMs - lastAttackMs;

    console.log(`[COMBAT]   Último ataque: ${lastAttackMs}`);
    console.log(`[COMBAT]   Tempo desde último: ${timeSinceLastAttack}ms`);
    console.log(`[COMBAT]   Cooldown necessário: ${cooldownMs}ms`);

    if (timeSinceLastAttack < cooldownMs) {
      console.warn(`[COMBAT] ❌ Cooldown ativo! Falta ${(cooldownMs - timeSinceLastAttack).toFixed(0)}ms`);
      return socket.emit("combat:attack_result", {
        ok: false,
        error: "COOLDOWN_ACTIVE",
        cooldownRemaining: cooldownMs - timeSinceLastAttack
      });
    }

    console.log(`[COMBAT] ✅ Cooldown OK`);

    // ===================================================================
    // 4. CARREGAR DADOS DO ALVO
    // ===================================================================

    console.log(`[COMBAT] 3. Carregando dados do alvo...`);

    let targetPos = null;
    let targetInstanceId = null;
    let targetStats = null;
    let targetDefense = 0;
    let targetEnemy = null;

    if (targetKind === "ENEMY") {
      const enemies = getEnemiesForInstance(attackerInstanceId);
      
      // ✨ REMOVER PREFIXO "enemy_" se existir
      const cleanTargetId = String(targetId).replace(/^enemy_/, '');
      
      console.log(`[COMBAT]   Procurando inimigo: ${targetId} (limpo: ${cleanTargetId})`);
      console.log(`[COMBAT]   Inimigos disponíveis: [${enemies.map(e => e.id).join(', ')}]`);
      
      targetEnemy = enemies.find(e => String(e.id) === cleanTargetId);

      if (!targetEnemy) {
        console.warn(`[COMBAT] ❌ Inimigo não encontrado: ${cleanTargetId}`);
        return socket.emit("combat:attack_result", {
          ok: false,
          error: "TARGET_NOT_FOUND"
        });
      }

      console.log(`[COMBAT] ✅ Inimigo encontrado: ${targetEnemy.id}, status=${targetEnemy.status}`);

      if (String(targetEnemy.status) !== "ALIVE") {
        console.warn(`[COMBAT] ❌ Inimigo não está ALIVE: ${targetEnemy.status}`);
        return socket.emit("combat:attack_result", {
          ok: false,
          error: "TARGET_NOT_ALIVE"
        });
      }

      targetInstanceId = String(targetEnemy.instanceId ?? "");
      targetPos = {
        x: Number(targetEnemy.pos?.x ?? 0),
        z: Number(targetEnemy.pos?.z ?? 0)
      };

      console.log(`[COMBAT]   Pos inimigo: (${targetPos.x.toFixed(2)}, ${targetPos.z.toFixed(2)})`);
      console.log(`[COMBAT]   InstanceId alvo: ${targetInstanceId}`);

      targetStats = await loadEnemyCombatStats(targetEnemy.id);
      if (!targetStats) {
        console.warn(`[COMBAT] ❌ Stats do inimigo não encontrados: ${targetEnemy.id}`);
        return socket.emit("combat:attack_result", {
          ok: false,
          error: "TARGET_STATS_NOT_FOUND"
        });
      }

      targetDefense = targetStats.defense || 0;
      console.log(`[COMBAT] ✅ Stats do inimigo carregados: defense=${targetDefense}`);

    } else if (targetKind === "PLAYER") {
      console.warn("[COMBAT] ❌ PvP não implementado");
      return socket.emit("combat:attack_result", {
        ok: false,
        error: "PvP_NOT_IMPLEMENTED"
      });
    } else {
      console.warn(`[COMBAT] ❌ Tipo de alvo desconhecido: ${targetKind}`);
      return socket.emit("combat:attack_result", {
        ok: false,
        error: "UNKNOWN_TARGET_KIND"
      });
    }

    // ===================================================================
    // 5. VALIDAR INSTÂNCIAS (✨ CORRIGIDO: String comparison)
    // ===================================================================

    console.log(`[COMBAT] 4. Validando instâncias...`);
    console.log(`[COMBAT]   Atacante instance: ${attackerInstanceId} (tipo: ${typeof attackerInstanceId})`);
    console.log(`[COMBAT]   Alvo instance: ${targetInstanceId} (tipo: ${typeof targetInstanceId})`);

    if (String(targetInstanceId) !== String(attackerInstanceId)) {
      console.warn(`[COMBAT] ❌ Instâncias diferentes: "${attackerInstanceId}" !== "${targetInstanceId}"`);
      return socket.emit("combat:attack_result", {
        ok: false,
        error: "DIFFERENT_INSTANCE"
      });
    }

    console.log(`[COMBAT] ✅ Instâncias iguais`);

    // ===================================================================
    // 6. VALIDAR DISTÂNCIA
    // ===================================================================

    console.log(`[COMBAT] 5. Validando distância...`);

    const dx = targetPos.x - attackerPos.x;
    const dz = targetPos.z - attackerPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    const attackRange = Number(attackerStats.attackRange);

    if (!Number.isFinite(attackRange) || attackRange <= 0) {
      console.warn(`[COMBAT] ❌ Range de ataque inválido para userId=${userId}`);
      return socket.emit("combat:attack_result", {
        ok: false,
        error: "INVALID_ATTACK_RANGE"
      });
    }

    console.log(`[COMBAT]   Distância: ${distance.toFixed(2)}`);
    console.log(`[COMBAT]   Range: ${attackRange}`);

    if (distance > attackRange) {
      console.warn(`[COMBAT] ❌ Muito longe! ${distance.toFixed(2)} > ${attackRange}`);
      return socket.emit("combat:attack_result", {
        ok: false,
        error: "OUT_OF_RANGE",
        distance,
        range: attackRange
      });
    }

    console.log(`[COMBAT] ✅ No range para atacar`);

    // ===================================================================
    // 7. EXECUTAR ATAQUE
    // ===================================================================

    console.log(`[COMBAT] 6. Executando ataque...`);

    // ✨ IMPORTANTE: Enviar o ID REAL do inimigo (sem prefixo)
    const combatResult = await executeAttack({
      attackerId: userId,
      attackerKind: "PLAYER",
      targetId: targetEnemy.id,  // ID REAL, não "enemy_2"
      targetKind: targetKind,
      attackerPos: attackerPos,
      targetPos: targetPos,
      attackerAttackPower: attackerStats.attackPower,
      attackerAttackSpeed: attackerStats.attackSpeed,
      targetDefense: targetDefense,
      attackRange: attackRange,
      lastAttackAtMs: attackerRuntime._lastAttackAtMs,
      nowMs: nowMs
    });

    if (!combatResult.ok) {
      console.warn(`[COMBAT] ❌ Ataque falhou: ${combatResult.error}`);
      console.log(`[COMBAT] Detalhes:`, combatResult);
      return socket.emit("combat:attack_result", {
        ok: false,
        error: combatResult.error,
        details: combatResult
      });
    }

    // Ataque bem-sucedido!
    attackerRuntime._lastAttackAtMs = nowMs;
    if (!attackerRuntime.combat) attackerRuntime.combat = {};
    attackerRuntime.combat.lastAttackAtMs = nowMs;

    console.log(`[COMBAT] ⚔️ ACERTO!`);
    console.log(`[COMBAT]   Player ${userId} acertou inimigo ${targetEnemy.id}`);
    console.log(`[COMBAT]   Dano: ${combatResult.damage}`);
    console.log(`[COMBAT]   HP inimigo: ${combatResult.targetHPBefore} → ${combatResult.targetHPAfter}/${combatResult.targetHPMax}`);

    // ===================================================================
    // 8. ✨ ATIVAR COMBATE REAL DO INIMIGO
    // ===================================================================

    console.log(`[COMBAT] 7. Ativando combate ativo do inimigo...`);
    
    if (targetEnemy) {
      // Se estava congelado, agora acorda
      if (targetEnemy._combatMode && !targetEnemy._combatActive) {
        console.log(`[COMBAT] 🎯 Enemy estava CONGELADO, ACORDANDO agora!`);
      }
      
      // Marcar como em combate ativo
      targetEnemy._combatMode = true;
      targetEnemy._combatActive = true;
      targetEnemy._combatTargetId = userId;
      targetEnemy._combatStartedAtMs = nowMs;
      targetEnemy._lastAttackAtMs = 0;
      
      // Salvar spawn se não tiver (para reset depois)
      if (!targetEnemy._spawnPos) {
        targetEnemy._spawnPos = { x: targetEnemy.pos.x, z: targetEnemy.pos.z };
        console.log(`[COMBAT] 📍 Spawn salvo: (${targetEnemy._spawnPos.x.toFixed(2)}, ${targetEnemy._spawnPos.z.toFixed(2)})`);
      }
      
      console.log(`[COMBAT] ✅ Enemy ${targetEnemy.id} ATIVO em combate`);
    }

    // ===================================================================
    // 9. EMITIR DANO PARA TODOS NA INSTÂNCIA
    // ===================================================================

    console.log(`[COMBAT] 8. Broadcasting dano para instância...`);

    // ✨ IMPORTANTE: Enviar prefixo no broadcast (para cliente)
    io.to(`inst:${attackerInstanceId}`).emit("combat:damage_taken", {
      attackerId: userId,
      targetId: `enemy_${targetEnemy.id}`,  // ← Com prefixo para cliente
      targetKind: targetKind,
      damage: combatResult.damage,
      targetHPBefore: combatResult.targetHPBefore,
      targetHPAfter: combatResult.targetHPAfter,
      targetHPMax: combatResult.targetHPMax,
      targetDied: combatResult.targetDied,
      timestamp: nowMs
    });

    socket.emit("combat:attack_result", {
      ok: true,
      damage: combatResult.damage,
      targetHPAfter: combatResult.targetHPAfter,
      targetHPMax: combatResult.targetHPMax,
      targetDied: combatResult.targetDied,
      cooldownMs: COMBAT_BASE_COOLDOWN_MS / (attackerStats.attackSpeed || 1)
    });

    console.log(`[COMBAT] ✅ Dano broadcast enviado`);

    // ===================================================================
    // 10. HANDLE MORTE DO INIMIGO
    // ===================================================================

    if (combatResult.targetDied && targetKind === "ENEMY") {
      console.log(`[COMBAT] ☠️ Enemy ${targetEnemy.id} MORREU!`);

      // Limpar combate do inimigo morto
      targetEnemy._combatMode = false;
      targetEnemy._combatActive = false;
      targetEnemy.status = "DEAD";

      // Criar loot container
      const lootContainer = await createLootContainerForEnemy(
        targetEnemy.id,
        targetEnemy.enemy_def_id,
        targetPos
      );

      if (lootContainer) {
        console.log(`[COMBAT] 🎁 Loot container criado`);
        
        // Notificar todos os players que container apareceu
        io.to(`inst:${attackerInstanceId}`).emit("world:object_spawn", {
          objectId: lootContainer.containerId,
          objectKind: "CONTAINER",
          position: lootContainer.position,
          containerDefId: lootContainer.containerDefId,
          slotCount: lootContainer.slotCount
        });

        console.log(`[COMBAT] Container em (${lootContainer.position.x.toFixed(2)}, ${lootContainer.position.z.toFixed(2)})`);
      }
    }

    console.log(`[COMBAT] ==========================================\n`);

  } catch (err) {
    console.error("[COMBAT] ❌ Exception:", err);
    console.error(err.stack);
    socket.emit("combat:attack_result", {
      ok: false,
      error: "INTERNAL_ERROR",
      details: err.message
    });
  }
}

/**
 * =====================================================================
 * Registrar listeners
 * =====================================================================
 */
function registerCombatHandlers(socket, io) {
  socket.on("combat:attack", (payload) => onCombatAttack(socket, io, payload));
  console.log(`[COMBAT] ✅ Handlers registrados para socket ${socket.id}`);
}

module.exports = {
  registerCombatHandlers
};
