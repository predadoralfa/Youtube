// server/state/movement/tickOnce.js
// ✨ COMPLETO: Combate AUTOMÁTICO - perseguição + ataque contínuo

const { getAllRuntimes, markRuntimeDirty } = require("../runtimeStore");
const { moveUserChunk, computeChunkFromPos } = require("../presenceIndex");
const { getActiveSocket } = require("../../socket/sessionIndex");

const { DT_MAX } = require("./config");
const { computeDtSeconds, normalize2D, clampPosToBounds, readRuntimeSpeedStrict } = require("./math");
const { bumpRev, toDelta } = require("./entity");
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
const { loadEnemyCombatStats } = require("../../service/combatSystem");

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

  // Validar cooldown
  if (!attackerRt.combat) attackerRt.combat = { lastAttackAtMs: 0 };
  const lastAttackMs = attackerRt.combat.lastAttackAtMs ?? 0;
  const stats = await loadPlayerCombatStats(userId);
  const cooldownMs = 1000 / (stats?.attackSpeed || 1);
  const timeSinceLastAttack = nowMs - lastAttackMs;

  if (timeSinceLastAttack < cooldownMs) {
    return false;
  }

  // Validar distância
  const attackRange = Number(attackerRt.combat?.attackRange ?? stats?.attackRange ?? 1.2);
  if (distance > attackRange) {
    return false;
  }

  // ===== EXECUTAR ATAQUE =====
  const enemyStats = await loadEnemyCombatStats(targetEnemy.id);
  const targetDefense = enemyStats?.defense || 0;
  const damage = Math.max(0, (stats?.attackPower || 10) - targetDefense);

  const targetHPBefore = readHpCurrent(targetEnemy) || 0;
  const targetHPAfter = Math.max(0, targetHPBefore - damage);
  const targetHPMax = readHpMax(targetEnemy) || 0;
  const targetDied = targetHPAfter <= 0;

  console.log(
    `[COMBAT] 🤖 AUTO HIT player=${userId} enemy=${targetEnemy.id} attackPower=${stats?.attackPower} defense=${targetDefense} damage=${damage} hp=${targetHPBefore}->${targetHPAfter}/${targetHPMax}`
  );

  // Atualizar HP do inimigo
  targetEnemy.hpCurrent = targetHPAfter;
  targetEnemy.hp_current = targetHPAfter;
  if (!targetEnemy.stats) targetEnemy.stats = {};
  targetEnemy.stats.hpCurrent = targetHPAfter;
  targetEnemy.stats.hpMax = targetHPMax;
  targetEnemy._hpChanged = true;

  try {
    const enemyStatsRow = await db.GaEnemyInstanceStats.findByPk(targetEnemy.id);
    if (enemyStatsRow) {
      await enemyStatsRow.update({ hp_current: targetHPAfter, hp_max: targetHPMax });
    }
    if (targetDied) {
      await db.GaEnemyInstance.update(
        { status: "DEAD" },
        { where: { id: targetEnemy.id } }
      );
    }
  } catch (err) {
    console.error(`[COMBAT] Failed to persist enemy hp for enemy=${targetEnemy.id}:`, err);
  }

  // Atualizar cooldown do player
  attackerRt.combat.lastAttackAtMs = nowMs;
  attackerRt._lastAttackAtMs = nowMs;

  // ===== ATIVAR COMBATE DO INIMIGO (se não estava ativo) =====
  if (!targetEnemy._combatActive) {
    targetEnemy._combatActive = true;
    targetEnemy._combatMode = true;
    targetEnemy._combatTargetId = userId;
    targetEnemy._lastAttackAtMs = 0;
  }
  targetEnemy._combatTargetId = userId;

  // ===== BROADCAST DO DANO =====
  const instanceId = attackerRt.instanceId;
  const combatEventId = `PLAYER:${userId}:ENEMY:${targetEnemy.id}:${nowMs}`;
  io.to(`inst:${instanceId}`).emit("combat:damage_taken", {
    eventId: combatEventId,
    attackerId: userId,
    targetId: `enemy_${targetEnemy.id}`,
    targetKind: "ENEMY",
    damage,
    targetHPBefore,
    targetHPAfter,
    targetHPMax,
    targetDied,
    timestamp: nowMs,
  });

  const activeSocket = getActiveSocket(userId);
  if (activeSocket) {
    activeSocket.emit("combat:attack_result", {
      ok: true,
      source: "AUTO",
      damage,
      targetHPAfter,
      targetHPMax,
      targetDied,
      attackPower: stats?.attackPower,
      cooldownMs,
    });
  }

  // ===== HANDLE MORTE =====
  if (targetDied) {
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
    const attackSpeed = Number(rt.combat?.attackSpeed ?? 1) || 1;
    const lastAttackMs = Number(rt.combat?.lastAttackAtMs ?? 0);
    const cooldownMs = 1000 / attackSpeed;
    const elapsedMs = Number(nowMs ?? Date.now()) - lastAttackMs;

    if (elapsedMs < cooldownMs) {
      return;
    }

    await executeServerSideAttack(io, rt, enemy);
    return;
  }

  // ===== COMBATE MÉDIO: PERSEGUIR =====
  // Sempre realinha o target para seguir o inimigo vivo
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

  // ========================================
  // ETAPA 0: COMBATE AUTOMÁTICO DOS PLAYERS
  // Roda independente do movimento para manter
  // a checagem de range/ataque em loop.
  // ========================================
  for (const rt of getAllRuntimes()) {
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

  for (const rt of getAllRuntimes()) {
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

    const tx = Number(rt.moveTarget.x);
    const tz = Number(rt.moveTarget.z);
    if (!Number.isFinite(tx) || !Number.isFinite(tz)) {
      // target corrompido => corta
      rt.moveTarget = null;
      rt.moveMode = "STOP";
      rt.action = "idle";
      bumpRev(rt);
      markRuntimeDirty(rt.userId, t);
      continue;
    }

    const dx = tx - rt.pos.x;
    const dz = tz - rt.pos.z;
    const dist = Math.hypot(dx, dz);

    const stopRadius = Number(rt.moveStopRadius ?? 0.45);
    const stopR = Number.isFinite(stopRadius) && stopRadius > 0 ? stopRadius : 0.45;

    // chegou (server-side)
    if (dist <= stopR) {
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
            dist,
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

    // move em direção ao target
    const dir = normalize2D(dx, dz);
    if (dir.x === 0 && dir.z === 0) continue;

    const desired = {
      x: rt.pos.x + dir.x * speed * dt,
      y: rt.pos.y,
      z: rt.pos.z + dir.z * speed * dt,
    };

    const clampedPos = clampPosToBounds(desired, rt.bounds);
    if (!clampedPos) continue;

    const moved = (clampedPos.x !== rt.pos.x) || (clampedPos.z !== rt.pos.z);

    // yaw autoritativo apontando para a direção do deslocamento
    const newYaw = Math.atan2(dir.x, dir.z);
    const yawChanged = rt.yaw !== newYaw;

    if (!moved && !yawChanged) continue;

    rt.pos = clampedPos;
    rt.yaw = newYaw;
    rt.action = "move";

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
        chunk: rt.chunk ?? { cx, cz },
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

  const allRuntimes = getAllRuntimes();
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
