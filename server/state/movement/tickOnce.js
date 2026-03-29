// server/state/movement/tickOnce.js
// ✨ COMPLETO: Combate AUTOMÁTICO - perseguição + ataque contínuo

const { getAllRuntimes, markRuntimeDirty } = require("../runtimeStore");
const { moveUserChunk, computeChunkFromPos } = require("../presenceIndex");
const { getActiveSocket } = require("../../socket/sessionIndex");

const { DT_MAX } = require("./config");
const { COMBAT_BASE_COOLDOWN_MS } = require("../../config/combatConstants");
const { computeDtSeconds, readRuntimeSpeedStrict } = require("./math");
const { moveEntityTowardTarget } = require("./entityMotion");
const { bumpRev, toDelta } = require("./entity");
const { applyStaminaTick } = require("./stamina");
const { readHpCurrent, readHpMax } = require("../enemies/enemyEntity");
const { emitDeltaToInterest } = require("./emit");
const { handleChunkTransition } = require("./chunkTransition");
const db = require("../../models");

// ✅ EXISTENTE: coleta de actors
const { attemptCollectFromActor } = require("../../service/actorCollectService");

// ✅ EXISTENTE: movimento de inimigos
const { tickEnemyMovement } = require("../enemies/enemyMovement");
const { emitEnemyDelta } = require("../enemies/enemyEmit");
const { getEnemiesForInstance, getEnemy } = require("../enemies/enemiesRuntimeStore");

// ✨ NOVO: IA do inimigo (combate) + attacks tracking
const { tickEnemyAI, getLastTickAttacks } = require("../enemies/enemyAI");
const { loadPlayerCombatStats } = require("../runtime/combatLoader");
const { executeAttack, loadEnemyCombatStats } = require("../../service/combatSystem");

function logStamina(event, payload) {
  if (process.env.STAMINA_LOG === "0") return;
  console.log(`[STAMINA] ${event}`, payload);
}

/**
 * ✨ NOVO: Executa ataque automático do servidor
 * Chamado quando player está em ENGAGED e dentro do range
 */
async function executeServerSideAttack(io, attackerRt, targetEnemy) {
  const userId = attackerRt.userId;
  const nowMs = Date.now();

  // ===== VALIDAÇÕES =====
  const attackerPos = {
    x: Number(attackerRt.pos?.x ?? 0),
    z: Number(attackerRt.pos?.z ?? 0),
  };

  const targetPos = {
    x: Number(targetEnemy.pos?.x ?? 0),
    z: Number(targetEnemy.pos?.z ?? 0),
  };

  // Distância
  const dx = targetPos.x - attackerPos.x;
  const dz = targetPos.z - attackerPos.z;
  const distance = Math.sqrt(dx * dx + dz * dz);

  const stats = await loadPlayerCombatStats(userId);
  const enemyStats = await loadEnemyCombatStats(targetEnemy.id);
  const targetDefense = enemyStats?.defense || 0;
  const attackRange = Number(attackerRt.combat?.attackRange ?? stats?.attackRange ?? 1.2);
  const combatResult = await executeAttack({
    attackerId: userId,
    attackerKind: "PLAYER",
    targetId: targetEnemy.id,
    targetKind: "ENEMY",
    attackerPos,
    targetPos,
    attackerAttackPower: stats?.attackPower,
    attackerAttackSpeed: stats?.attackSpeed,
    targetDefense,
    attackRange,
    lastAttackAtMs: Number(attackerRt.combat?.lastAttackAtMs ?? 0),
    nowMs,
  });

  if (!combatResult.ok) {
    return false;
  }

  console.log(
    `[COMBAT] 🤖 AUTO HIT player=${userId} enemy=${targetEnemy.id} attackPower=${stats?.attackPower} defense=${targetDefense} damage=${combatResult.damage} hp=${combatResult.targetHPBefore}->${combatResult.targetHPAfter}/${combatResult.targetHPMax}`
  );

  if (!targetEnemy.stats) targetEnemy.stats = {};
  targetEnemy.hpCurrent = combatResult.targetHPAfter;
  targetEnemy.hp_current = combatResult.targetHPAfter;
  targetEnemy.stats.hpCurrent = combatResult.targetHPAfter;
  targetEnemy.stats.hpMax = combatResult.targetHPMax;
  targetEnemy._hpChanged = true;

  try {
    const enemyStatsRow = await db.GaEnemyInstanceStats.findByPk(targetEnemy.id);
    if (enemyStatsRow) {
      await enemyStatsRow.update({ hp_current: combatResult.targetHPAfter, hp_max: combatResult.targetHPMax });
    }
    if (combatResult.targetDied) {
      await db.GaEnemyInstance.update(
        { status: "DEAD" },
        { where: { id: targetEnemy.id } }
      );
    }
  } catch (err) {
    console.error(`[COMBAT] Failed to persist enemy hp for enemy=${targetEnemy.id}:`, err);
  }

  if (!attackerRt.combat) attackerRt.combat = {};
  attackerRt.combat.lastAttackAtMs = nowMs;
  attackerRt._lastAttackAtMs = nowMs;

  if (!targetEnemy._combatActive) {
    targetEnemy._combatActive = true;
    targetEnemy._combatMode = true;
    targetEnemy._combatTargetId = userId;
    targetEnemy._lastAttackAtMs = 0;
  }
  targetEnemy._combatTargetId = userId;

  const instanceId = attackerRt.instanceId;
  const combatEventId = `PLAYER:${userId}:ENEMY:${targetEnemy.id}:${nowMs}`;
  io.to(`inst:${instanceId}`).emit("combat:damage_taken", {
    eventId: combatEventId,
    attackerId: userId,
    targetId: `enemy_${targetEnemy.id}`,
    targetKind: "ENEMY",
    damage: combatResult.damage,
    targetHPBefore: combatResult.targetHPBefore,
    targetHPAfter: combatResult.targetHPAfter,
    targetHPMax: combatResult.targetHPMax,
    targetDied: combatResult.targetDied,
    timestamp: nowMs,
  });

  const activeSocket = getActiveSocket(userId);
  if (activeSocket) {
    activeSocket.emit("combat:attack_result", {
      ok: true,
      source: "AUTO",
      damage: combatResult.damage,
      targetHPAfter: combatResult.targetHPAfter,
      targetHPMax: combatResult.targetHPMax,
      targetDied: combatResult.targetDied,
      attackPower: stats?.attackPower,
      cooldownMs: combatResult.cooldownMs,
    });
  }

  if (combatResult.targetDied) {
    targetEnemy.status = "DEAD";
  }

  return true;
}

/**
 * ✨ NOVO: Processa combate automático para player em ENGAGED
 */
async function processAutomaticCombat(io, rt, instanceId, nowMs) {
  if (!rt.combat || rt.combat.state !== "ENGAGED") {
    return;
  }

  const targetId = rt.combat.targetId;
  const targetKind = rt.combat.targetKind;

  if (!targetId || targetKind !== "ENEMY") {
    return;
  }

  // Obter inimigo
  const cleanEnemyId = String(targetId).replace(/^enemy_/, '');
  const enemy = getEnemy(cleanEnemyId);

  if (!enemy) {
    rt.combat.state = "IDLE";
    rt.combat.targetId = null;
    rt.combat.targetKind = null;
    return;
  }

  if (String(enemy.status) !== "ALIVE") {
    rt.combat.state = "IDLE";
    rt.combat.targetId = null;
    rt.combat.targetKind = null;
    return;
  }

  // Calcular distância
  const playerPos = rt.pos;
  const enemyPos = enemy.pos;

  const dx = enemyPos.x - playerPos.x;
  const dz = enemyPos.z - playerPos.z;
  const distance = Math.sqrt(dx * dx + dz * dz);

  const ATTACK_RANGE = Number(rt.combat?.attackRange ?? 1.2); // Quando ataca
  const APPROACH_STOP_RADIUS = 0.1;

  // ===== COMBATE PERTO: ATACAR =====
  if (distance <= ATTACK_RANGE) {
    let stats;
    try {
      stats = await loadPlayerCombatStats(rt.userId);
    } catch (err) {
      console.error(`[COMBAT] Invalid player combat stats for user=${rt.userId}:`, err.message);
      return;
    }

    const attackSpeed = Number(stats?.attackSpeed ?? rt.combat?.attackSpeed ?? 1) || 1;
    const lastAttackMs = Number(rt.combat?.lastAttackAtMs ?? 0);
    const cooldownMs = COMBAT_BASE_COOLDOWN_MS / attackSpeed;
    const elapsedMs = Number(nowMs ?? Date.now()) - lastAttackMs;

    if (elapsedMs < cooldownMs) {
      return;
    }

    await executeServerSideAttack(io, rt, enemy);
    return;
  }

  // ===== COMBATE MÉDIO: PERSEGUIR =====
  // Sempre realinha o target para seguir o inimigo vivo
  try {
    await loadPlayerCombatStats(rt.userId);
  } catch (err) {
    console.error(`[COMBAT] Invalid player combat stats for user=${rt.userId}:`, err.message);
    return;
  }

  rt.moveMode = "CLICK";
  rt.moveTarget = { x: enemyPos.x, z: enemyPos.z };
  rt.moveStopRadius = APPROACH_STOP_RADIUS;
  rt.action = "move";
}

/**
 * Um tick de movimento com combate automático integrado.
 */
async function tickOnce(io, nowMsValue) {
  const t = nowMsValue;
  const allRuntimes = Array.from(getAllRuntimes());

  // ========================================
  // ETAPA 0: COMBATE AUTOMÁTICO DOS PLAYERS
  // Roda independente do movimento para manter
  // a checagem de range/ataque em loop.
  // ========================================
  for (const rt of allRuntimes) {
    if (!rt) continue;
    if (rt.connectionState === "DISCONNECTED_PENDING" || rt.connectionState === "OFFLINE") {
      continue;
    }

    if (rt.combat?.state === "ENGAGED" && rt.combat?.targetKind === "ENEMY") {
      await processAutomaticCombat(io, rt, rt.instanceId, t);
    }
  }

  // ========================================
  // ETAPA 1: Movimento de PLAYERS
  // (código original abaixo, SEM MUDANÇAS)
  // ========================================

  for (const rt of allRuntimes) {
    if (!rt) continue;

    // ignora grace/offline: não "anda durante o pending"
    if (rt.connectionState === "DISCONNECTED_PENDING" || rt.connectionState === "OFFLINE") {
      continue;
    }

    if (rt.moveMode !== "CLICK") continue;
    if (!rt.moveTarget) continue;

    // dt server-side
    const dt = computeDtSeconds(t, rt.moveTickAtMs, DT_MAX);
    rt.moveTickAtMs = t;

    if (dt <= 0) continue;

    const speed = readRuntimeSpeedStrict(rt);
    if (speed == null) continue;

    // bounds obrigatório
    if (!rt.bounds) continue;

    const target = rt.moveTarget;
    if (!Number.isFinite(Number(target?.x)) || !Number.isFinite(Number(target?.z))) {
      // target corrompido => corta
      rt.moveTarget = null;
      rt.moveMode = "STOP";
      rt.action = "idle";
      bumpRev(rt);
      markRuntimeDirty(rt.userId, t);
      continue;
    }

    const stopRadius = Number(rt.moveStopRadius ?? 0.75);
    const stopR = Number.isFinite(stopRadius) && stopRadius > 0 ? stopRadius : 0.75;

    const movement = moveEntityTowardTarget({
      pos: rt.pos,
      target,
      speed,
      dt,
      bounds: rt.bounds,
      stopRadius: stopR,
    });

    if (!movement.ok) continue;

    // chegou (server-side)
    if (movement.reached) {
      // ================================================================
      // ✅ SE INTERACT ATIVO (HOLD-TO-COLLECT):
      // ✅ NÃO PARA O MOVIMENTO, CONTINUA PARA COLETAR EM LOOP
      // ================================================================
      if (rt.interact?.active && rt.interact?.kind === "ACTOR") {
        const lastCollect = rt.lastActorCollectAtMs ?? 0;
        const collectCooldown = rt.collectCooldownMs ?? 1000;

        // Respeita cooldown de 1seg entre coletas
        if (t >= lastCollect + collectCooldown) {
          rt.lastActorCollectAtMs = t;

          console.log("[COLLECT] Coletando (hold-to-collect)", {
            userId: rt.userId,
            actorId: rt.interact.id,
            dist: movement.distance,
          });

          // Fire-and-forget: não bloqueia o tick loop
          attemptCollectFromActor(rt.userId, rt.interact.id)
            .then((result) => {
              if (!result?.ok) {
                console.warn(
                  `[COLLECT] Erro ao coletar: userId=${rt.userId} actorId=${rt.interact.id} error=${result?.error}`
                );
                return;
              }

              // ✅ Coleta bem-sucedida: emitir eventos para client
              const activeSocket = getActiveSocket(rt.userId);
              if (activeSocket) {
                activeSocket.emit("actor:collected", {
                  actorId: String(rt.interact.id),
                  actorDisabled: result.actorDisabled,
                  inventory: result.inventoryFull,
                });
              }
            })
            .catch((err) => {
              console.error(
                `[COLLECT] Erro ao coletar: userId=${rt.userId} actorId=${rt.interact.id}`,
                err
              );
            });
        }

        // ✅ MANTÉM moveTarget e chunk para continuar coletando
        // Não faz o continue abaixo que pararia o loop
        // Continua para fazer emit de move:state (feedback ao client)
      } else if (rt.combat?.state === "ENGAGED" && rt.combat?.targetKind === "ENEMY") {
        // Em combate, não solta o target ao chegar perto; o combate decide se ataca ou persegue.
        rt.action = "move";
        await processAutomaticCombat(io, rt, rt.instanceId, t);
      } else {
        // ================================================================
        // SE NÃO ESTÁ EM INTERACT LOOP: PARA NORMALMENTE
        // ================================================================
        rt.moveTarget = null;
        rt.moveMode = "STOP";
        if (rt.action !== "idle") rt.action = "idle";
      }

      if (rt.combat?.state === "ENGAGED" && rt.combat?.targetKind === "ENEMY") {
        continue;
      }

      bumpRev(rt);
      markRuntimeDirty(rt.userId, t);

      const socket = getActiveSocket(rt.userId);
      const delta = toDelta(rt);

      emitDeltaToInterest(io, socket, rt.userId, delta);
      if (socket) {
        socket.emit("move:state", {
          entityId: String(rt.userId),
          pos: rt.pos,
          yaw: rt.yaw,
          rev: rt.rev ?? 0,
          vitals: delta.vitals,
          chunk: rt.chunk ?? computeChunkFromPos(rt.pos),
        });
      }

      // ✅ SÓ FAZ CONTINUE SE NÃO ESTÁ EM INTERACT LOOP
      if (!rt.interact?.active || rt.interact?.kind !== "ACTOR") {
        continue;
      }
      // Se está em loop de coleta, continua para voltar ao início do for
      // e fazer movimento novamente no próximo tick (caso afaste)
      continue;
    }

    const moved = movement.moved;
    const newYaw = movement.yaw;
    const yawChanged = newYaw != null && rt.yaw !== newYaw;
    const staminaResult = applyStaminaTick(rt, t, {
      movedReal: moved,
    });

    if (!moved && !yawChanged && !staminaResult.changed) continue;

    rt.pos = movement.pos;
    if (newYaw != null) rt.yaw = newYaw;
    rt.action = "move";

    if (staminaResult.changed) {
      logStamina("click_move_or_idle_tick", {
        userId: rt.userId,
        movedReal: moved,
        dt: Number(staminaResult.dt?.toFixed?.(4) ?? staminaResult.dt ?? 0),
        hpCurrent: Number(staminaResult.hpCurrent ?? 0),
        hpMax: Number(staminaResult.hpMax ?? 0),
        hpRegen: Number(staminaResult.hpRegen ?? 0),
        regen: Number(staminaResult.regen?.toFixed?.(4) ?? staminaResult.regen ?? 0),
        drain: Number(staminaResult.drain?.toFixed?.(4) ?? staminaResult.drain ?? 0),
        staminaCurrent: Number(rt.staminaCurrent ?? 0),
        staminaMax: Number(rt.staminaMax ?? 0),
      });
    }

    bumpRev(rt);
    markRuntimeDirty(rt.userId, t);

    // chunk transition
    const { cx, cz } = computeChunkFromPos(rt.pos);
    const prevCx = Number(rt.chunk?.cx);
    const prevCz = Number(rt.chunk?.cz);
    const chunkChanged = prevCx !== cx || prevCz !== cz;

    const socket = getActiveSocket(rt.userId);

    if (chunkChanged) {
      const movedInfo = moveUserChunk(rt.userId, cx, cz);
      rt.chunk = { cx, cz };

      if (socket && movedInfo?.diff?.entered) {
        for (const r of movedInfo.diff.entered) socket.join(r);
      }
      if (socket && movedInfo?.diff?.left) {
        for (const r of movedInfo.diff.left) socket.leave(r);
      }

      if (movedInfo) {
        handleChunkTransition(io, socket, rt, movedInfo);
      }
    }

    // delta para outros
    const delta = toDelta(rt);
    emitDeltaToInterest(io, socket, rt.userId, delta);

    // feedback local
    if (socket) {
      socket.emit("move:state", {
        entityId: String(rt.userId),
        pos: rt.pos,
        yaw: rt.yaw,
        rev: rt.rev ?? 0,
        vitals: delta.vitals,
        chunk: rt.chunk ?? computeChunkFromPos(rt.pos),
      });
    }

    if (rt.combat?.state === "ENGAGED" && rt.combat?.targetKind === "ENEMY") {
      await processAutomaticCombat(io, rt, rt.instanceId, t);
    }
  }

  // ========================================
  // ETAPA 2A: Movimento de INIMIGOS (ALEATÓRIO)
  // ========================================
  // Processa movimento aleatório de inimigos
  // de todas as instâncias ativas

  for (const rt of allRuntimes) {
    if (!rt) continue;

    if (rt.connectionState === "DISCONNECTED_PENDING" || rt.connectionState === "OFFLINE") {
      continue;
    }

    const staminaResult = applyStaminaTick(rt, t, {
      movedReal: false,
    });

    if (!staminaResult.changed) continue;

    logStamina("regen_tick", {
      userId: rt.userId,
      movedReal: false,
      dt: Number(staminaResult.dt?.toFixed?.(4) ?? staminaResult.dt ?? 0),
      hpCurrent: Number(staminaResult.hpCurrent ?? 0),
      hpMax: Number(staminaResult.hpMax ?? 0),
      hpRegen: Number(staminaResult.hpRegen ?? 0),
      regen: Number(staminaResult.regen?.toFixed?.(4) ?? staminaResult.regen ?? 0),
      drain: Number(staminaResult.drain?.toFixed?.(4) ?? staminaResult.drain ?? 0),
      staminaCurrent: Number(rt.staminaCurrent ?? 0),
      staminaMax: Number(rt.staminaMax ?? 0),
    });

    bumpRev(rt);
    markRuntimeDirty(rt.userId, t);

    const socket = getActiveSocket(rt.userId);
    const delta = toDelta(rt);
    emitDeltaToInterest(io, socket, rt.userId, delta);

    if (socket) {
      socket.emit("move:state", {
        entityId: String(rt.userId),
        pos: rt.pos,
        yaw: rt.yaw,
        rev: rt.rev ?? 0,
        chunk: rt.chunk ?? computeChunkFromPos(rt.pos),
        vitals: delta.vitals,
      });
    }
  }

  const uniqueInstanceIds = new Set();

  // Coletar IDs únicos de instâncias
  for (const rt of allRuntimes) {
    if (rt?.instanceId) {
      uniqueInstanceIds.add(rt.instanceId);
    }
  }

  // ========================================
  // ETAPA 2B: IA DO INIMIGO (COMBATE)
  // ========================================

  for (const instanceId of uniqueInstanceIds) {
    const dt = 0.05; // 50ms em segundos (DT_MAX)

    // Processar movimento aleatório
    const changedEnemies = tickEnemyMovement(instanceId, t, dt);

    // Emitir deltas dos inimigos que mudaram
    for (const enemy of changedEnemies) {
      emitEnemyDelta(io, enemy);
    }

    // Processar IA de combate (perseguição, auto-ataque)
    const enemies = getEnemiesForInstance(instanceId);
    const aiChangedEnemies = await tickEnemyAI(enemies, t, dt);

    // Emitir deltas dos inimigos que mudaram por IA
    for (const enemy of aiChangedEnemies) {
      emitEnemyDelta(io, enemy);
    }

    // ========================================
    // ✨ NOVO: COMBATE AUTOMÁTICO DO PLAYER
    // ========================================

    // Processar combate automático para todos os players em ENGAGED
    for (const rt of allRuntimes) {
      if (!rt || String(rt.instanceId) !== String(instanceId)) continue;

      await processAutomaticCombat(io, rt, instanceId, t);
    }

    // ========================================
    // ✨ BROADCAST DE ATAQUES DO INIMIGO
    // ========================================

    const attacks = getLastTickAttacks(enemies);

    if (attacks && Array.isArray(attacks) && attacks.length > 0) {
    for (const attack of attacks) {
        const enemyEventId = `ENEMY:${attack.enemyId}:PLAYER:${attack.targetId}:${t}`;
        io.to(`inst:${instanceId}`).emit("combat:enemy_attack", {
          eventId: enemyEventId,
          enemyId: `enemy_${attack.enemyId}`,
          targetId: attack.targetId,
          targetKind: "PLAYER",
          attackPower: attack.attackPower,
          damage: attack.damage,
          targetHPBefore: attack.targetHPBefore,
          targetHPAfter: attack.targetHPAfter,
          targetHPMax: attack.targetHPMax,
          targetDied: attack.targetDied,
          timestamp: t,
        });
      }
    }

    // ========================================
    // ✨ CLEANUP DE INIMIGOS MORTOS
    // ========================================

    for (const enemy of enemies) {
      if (enemy.status === "DEAD") {
        console.log(`[TICKONCE] 💀 Despawning enemy ${enemy.id} (dead)`);

        io.to(`inst:${instanceId}`).emit("entity:despawn", {
          entityId: `enemy_${enemy.id}`,
        });
      }
    }

    // ========================================
    // ✨ ATUALIZAR HP DE INIMIGOS NO CLIENTE
    // ========================================

    for (const enemy of enemies) {
      if (enemy.status === "ALIVE" && enemy._hpChanged) {
        emitEnemyDelta(io, enemy);
        enemy._hpChanged = false;
      }
    }
  }
}

module.exports = {
  tickOnce,
};
