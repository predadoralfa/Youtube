// server/socket/handlers/interactHandler.js
// ✨ COMPLETO: Combate automático com rt.combat.state = "ENGAGED"

const db = require("../../models");

const {
  ensureRuntimeLoaded,
  getRuntime,
  isWASDActive,
} = require("../../state/runtimeStore");

const { getActor } = require("../../state/actorsRuntimeStore");
const { getEnemy, getEnemiesForInstance } = require("../../state/enemies/enemiesRuntimeStore");

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

const DEFAULT_STOP_RADIUS = 1.25;
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Resolve a posição autoritativa do alvo.
 */
function resolveTargetPos({ requesterRt, target }) {
  console.log(`[INTERACT_DEBUG] resolveTargetPos: kind=${target.kind}, id=${target.id}`);
  
  if (!target?.kind || target?.id == null) {
    console.log(`[INTERACT_DEBUG] ❌ Target inválido`);
    return null;
  }

  if (target.kind === "PLAYER") {
    const other = getRuntime(String(target.id));
    if (!other) {
      console.log(`[INTERACT_DEBUG] ❌ Player ${target.id} não encontrado`);
      return null;
    }

    if (String(other.instanceId) !== String(requesterRt.instanceId)) {
      console.log(`[INTERACT_DEBUG] ❌ Instâncias diferentes`);
      return null;
    }

    const p = other.pos;
    if (!p || !isFiniteNumber(p.x) || !isFiniteNumber(p.z)) {
      console.log(`[INTERACT_DEBUG] ❌ Posição player inválida`);
      return null;
    }

    console.log(`[INTERACT_DEBUG] ✅ Player pos: (${p.x}, ${p.z})`);
    return { x: p.x, z: p.z };
  }

  if (target.kind === "ACTOR") {
    const actor = getActor(String(target.id));
    if (!actor) {
      console.log(`[INTERACT_DEBUG] ❌ Actor ${target.id} não encontrado`);
      return null;
    }

    if (String(actor.instanceId) !== String(requesterRt.instanceId)) {
      console.log(`[INTERACT_DEBUG] ❌ Actor em instância diferente`);
      return null;
    }

    const p = actor.pos;
    if (!p || !isFiniteNumber(p.x) || !isFiniteNumber(p.z)) {
      console.log(`[INTERACT_DEBUG] ❌ Posição actor inválida`);
      return null;
    }

    console.log(`[INTERACT_DEBUG] ✅ Actor pos: (${p.x}, ${p.z})`);
    return { x: p.x, z: p.z };
  }

  if (target.kind === "ENEMY") {
    // ✨ LIMPAR PREFIXO: "enemy_2" → "2"
    const cleanId = String(target.id).replace(/^enemy_/, '');
    console.log(`[INTERACT_DEBUG] 🎯 Procurando enemy: ${target.id} → limpando para ${cleanId}`);
    
    const enemy = getEnemy(cleanId);
    if (!enemy) {
      console.log(`[INTERACT_DEBUG] ❌ Enemy ${cleanId} não encontrado em getEnemy`);
      return null;
    }

    console.log(`[INTERACT_DEBUG] ✅ Enemy encontrado! status=${enemy.status}`);

    if (String(enemy.instanceId) !== String(requesterRt.instanceId)) {
      console.log(`[INTERACT_DEBUG] ❌ Enemy em instância diferente: ${enemy.instanceId} vs ${requesterRt.instanceId}`);
      return null;
    }

    if (String(enemy.status) !== "ALIVE") {
      console.log(`[INTERACT_DEBUG] ❌ Enemy não está ALIVE: ${enemy.status}`);
      return null;
    }

    const p = enemy.pos;
    if (!p || !isFiniteNumber(p.x) || !isFiniteNumber(p.z)) {
      console.log(`[INTERACT_DEBUG] ❌ Posição enemy inválida:`, p);
      return null;
    }

    console.log(`[INTERACT_DEBUG] ✅ Enemy pos: (${p.x}, ${p.z})`);
    return { x: p.x, z: p.z };
  }

  console.log(`[INTERACT_DEBUG] ❌ Kind desconhecido: ${target.kind}`);
  return null;
}

function applyApproach({ rt, nowMs, targetPos, stopRadius }) {
  console.log(`[INTERACT_DEBUG] applyApproach: targetPos=(${targetPos.x}, ${targetPos.z}), stopRadius=${stopRadius}`);
  
  const b = rt.bounds;
  if (!b) {
    console.log(`[INTERACT_DEBUG] ❌ Sem bounds`);
    return false;
  }

  const minX = Number(b.minX);
  const maxX = Number(b.maxX);
  const minZ = Number(b.minZ);
  const maxZ = Number(b.maxZ);

  console.log(`[INTERACT_DEBUG] Bounds: X=[${minX}, ${maxX}], Z=[${minZ}, ${maxZ}]`);

  if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) {
    console.log(`[INTERACT_DEBUG] ❌ Bounds não são válidos`);
    return false;
  }

  const tx = clamp(Number(targetPos.x), minX, maxX);
  const tz = clamp(Number(targetPos.z), minZ, maxZ);

  console.log(`[INTERACT_DEBUG] ✅ Clamped target: (${tx}, ${tz})`);

  rt.moveMode = "CLICK";
  rt.moveTarget = { x: tx, z: tz };
  rt.moveStopRadius = stopRadius;
  rt.moveTickAtMs = nowMs;
  rt.action = "move";

  console.log(`[INTERACT_DEBUG] ✅ Movimento iniciado: moveTarget=(${rt.moveTarget.x}, ${rt.moveTarget.z}), stopRadius=${stopRadius}`);

  return true;
}

/**
 * ✨ Inicia combate automático com inimigo
 * Agora também ativa rt.combat.state = "ENGAGED"
 */
function startEnemyCombat({ enemy, attackerUserId, nowMs, rt }) {
  console.log(`[INTERACT_DEBUG] startEnemyCombat: enemy=${enemy.id}, attacker=${attackerUserId}`);
  
  if (!enemy) {
    console.log(`[INTERACT_DEBUG] ❌ Enemy é null`);
    return false;
  }

  // ✨ NOVO: Marcar inimigo como em combate
  enemy._combatMode = true;
  enemy._combatActive = false;  // Ainda congelado até primeiro ataque
  enemy._combatTargetId = attackerUserId;
  enemy._combatStartedAtMs = nowMs;
  enemy._lastAttackAtMs = 0;

  // ✨ NOVO: Marcar player como em combate automático
  if (rt && rt.combat) {
    rt.combat.state = "ENGAGED";
    rt.combat.targetId = enemy.id;
    rt.combat.targetKind = "ENEMY";
  }

  console.log(`[INTERACT_DEBUG] ✅ Enemy ${enemy.id} em combate! Target: player ${attackerUserId}`);
  console.log(`[INTERACT_DEBUG] ✅ Player state=ENGAGED, targetId=${enemy.id}`);
  
  return true;
}

function registerInteractHandler(io, socket) {
  socket.on("interact:start", async (payload = {}) => {
    console.log(`\n[INTERACT_DEBUG] ==================== INTERACT:START ====================`);
    console.log(`[INTERACT_DEBUG] Payload:`, JSON.stringify(payload, null, 2));
    
    try {
      console.log(`[INTERACT_DEBUG] 1. Verificando worldJoined...`);
      if (socket.data?._worldJoined !== true) {
        console.log(`[INTERACT_DEBUG] ❌ Não está joined ao mundo`);
        return;
      }
      console.log(`[INTERACT_DEBUG] ✅ Joined ao mundo`);

      const userId = socket.data.userId;
      const nowMs = Date.now();
      console.log(`[INTERACT_DEBUG] 2. userId=${userId}, nowMs=${nowMs}`);

      console.log(`[INTERACT_DEBUG] 3. Garantindo runtime carregado...`);
      await ensureRuntimeLoaded(userId);
      const rt = getRuntime(userId);
      if (!rt) {
        console.log(`[INTERACT_DEBUG] ❌ Runtime não encontrado para user ${userId}`);
        return;
      }
      console.log(`[INTERACT_DEBUG] ✅ Runtime encontrado`);

      console.log(`[INTERACT_DEBUG] 4. Carregando stats...`);
      const stats = await db.GaUserStats.findByPk(userId, {
        attributes: ["collect_cooldown_ms"],
      });
      rt.collectCooldownMs = stats?.collect_cooldown_ms ?? 1000;
      console.log(`[INTERACT_DEBUG] ✅ Stats carregados`);

      if (
        rt.connectionState === "DISCONNECTED_PENDING" ||
        rt.connectionState === "OFFLINE"
      ) {
        console.log(`[INTERACT_DEBUG] ❌ Player está ${rt.connectionState}`);
        return;
      }

      console.log(`[INTERACT_DEBUG] 5. Verificando WASD ativo...`);
      if (isWASDActive(rt, nowMs)) {
        console.log(`[INTERACT_DEBUG] ❌ WASD está ativo`);
        return;
      }
      console.log(`[INTERACT_DEBUG] ✅ WASD não está ativo`);

      const target = payload?.target;
      console.log(`[INTERACT_DEBUG] 6. Target:`, target);
      
      if (!target?.kind || target?.id == null) {
        console.log(`[INTERACT_DEBUG] ❌ Target inválido`);
        return;
      }

      const targetKind = String(target.kind);
      console.log(`[INTERACT_DEBUG] 7. targetKind=${targetKind}`);

      if (targetKind === "PLAYER" && String(target.id) === String(userId)) {
        console.log(`[INTERACT_DEBUG] ❌ Tentando interagir com a si mesmo`);
        return;
      }

      if (
        targetKind !== "PLAYER" &&
        targetKind !== "ACTOR" &&
        targetKind !== "ENEMY"
      ) {
        console.log(`[INTERACT_DEBUG] ❌ targetKind desconhecido: ${targetKind}`);
        return;
      }

      const stopRadiusRaw = payload?.stopRadius;
      const stopRadius =
        isFiniteNumber(stopRadiusRaw) && stopRadiusRaw > 0
          ? stopRadiusRaw
          : DEFAULT_STOP_RADIUS;
      console.log(`[INTERACT_DEBUG] 8. stopRadius=${stopRadius}`);

      const timeoutMsRaw = payload?.timeoutMs;
      const timeoutMs =
        isFiniteNumber(timeoutMsRaw) && timeoutMsRaw > 0
          ? timeoutMsRaw
          : DEFAULT_TIMEOUT_MS;
      console.log(`[INTERACT_DEBUG] 9. timeoutMs=${timeoutMs}`);

      console.log(`[INTERACT_DEBUG] 10. Resolvendo posição do alvo...`);
      const targetPos = resolveTargetPos({
        requesterRt: rt,
        target: { kind: targetKind, id: String(target.id) },
      });

      if (!targetPos) {
        console.log(`[INTERACT_DEBUG] ❌ Não conseguiu resolver posição do alvo`);
        return;
      }
      console.log(`[INTERACT_DEBUG] ✅ Posição resolvida: (${targetPos.x}, ${targetPos.z})`);

      // PARA INIMIGOS: iniciar combate automático
      if (targetKind === "ENEMY") {
        console.log(`[INTERACT_DEBUG] 11. É um ENEMY! Iniciando combate automático...`);
        
        // ✨ LIMPAR PREFIXO AQUI TAMBÉM!
        const cleanEnemyId = String(target.id).replace(/^enemy_/, '');
        const enemy = getEnemy(cleanEnemyId);
        
        if (!enemy) {
          console.log(`[INTERACT_DEBUG] ❌ Enemy ${cleanEnemyId} não encontrado em startEnemyCombat`);
          return;
        }
        
        if (String(enemy.status) !== "ALIVE") {
          console.log(`[INTERACT_DEBUG] ❌ Enemy não está ALIVE: ${enemy.status}`);
          return;
        }

        // ✨ Passar rt para ativar rt.combat.state = "ENGAGED"
        startEnemyCombat({ enemy, attackerUserId: userId, nowMs, rt });
        console.log(`[INTERACT_DEBUG] ✅ Combate automático iniciado`);
        
        const combatStopRadius = 1.2;
        console.log(`[INTERACT_DEBUG] 12. Aplicando movimento com stopRadius=${combatStopRadius}...`);
        const moveOk = applyApproach({ rt, nowMs, targetPos, stopRadius: combatStopRadius });
        if (!moveOk) {
          console.log(`[INTERACT_DEBUG] ❌ Falha ao aplicar movimento`);
          return;
        }
        console.log(`[INTERACT_DEBUG] ✅ Movimento aplicado`);
      } else {
        console.log(`[INTERACT_DEBUG] 11. É ${targetKind} (não é ENEMY), movimento normal...`);
        const moveOk = applyApproach({ rt, nowMs, targetPos, stopRadius });
        if (!moveOk) {
          console.log(`[INTERACT_DEBUG] ❌ Falha ao aplicar movimento`);
          return;
        }
        console.log(`[INTERACT_DEBUG] ✅ Movimento aplicado`);
      }

      rt.interact = {
        active: true,
        kind: targetKind,
        id: String(target.id),
        stopRadius,
        startedAtMs: nowMs,
        timeoutMs,
      };

      console.log(`[INTERACT_DEBUG] ✅ INTERACT:START COMPLETO!`);
      console.log(`[INTERACT_DEBUG] rt.moveTarget=${JSON.stringify(rt.moveTarget)}`);
      console.log(`[INTERACT_DEBUG] rt.interact=${JSON.stringify(rt.interact)}`);
      console.log(`[INTERACT_DEBUG] rt.combat.state=${rt.combat?.state}`);
      console.log(`[INTERACT_DEBUG] ==========================================\n`);

    } catch (e) {
      console.error("[INTERACT_DEBUG] ❌ EXCEPTION:", e);
      console.error(e.stack);
    }
  });

  socket.on("interact:stop", async () => {
    console.log(`[INTERACT_DEBUG] interact:stop recebido`);
    try {
      if (socket.data?._worldJoined !== true) return;

      const userId = socket.data.userId;

      await ensureRuntimeLoaded(userId);
      const rt = getRuntime(userId);
      if (!rt) return;

      const cur = rt.interact;
      if (!cur?.active) {
        console.log(`[INTERACT_DEBUG] Nenhum interact ativo`);
        return;
      }

      if (cur.kind === "ENEMY") {
        // ✨ LIMPAR PREFIXO AQUI TAMBÉM!
        const cleanEnemyId = String(cur.id).replace(/^enemy_/, '');
        const enemy = getEnemy(cleanEnemyId);
        
        if (enemy) {
          if (String(enemy._combatTargetId) === String(userId)) {
            console.log(`[INTERACT_DEBUG] Saindo de combate com enemy ${enemy.id}`);
            enemy._combatMode = false;
            enemy._combatActive = false;
            enemy._combatTargetId = null;
          }
        }

        // ✨ NOVO: Resetar estado de combate do player
        if (rt.combat) {
          console.log(`[INTERACT_DEBUG] Resetando combat.state para IDLE`);
          rt.combat.state = "IDLE";
          rt.combat.targetId = null;
          rt.combat.targetKind = null;
        }
      }

      rt.interact = null;
      console.log(`[INTERACT_DEBUG] ✅ interact:stop completo`);
    } catch (e) {
      console.error("[INTERACT_DEBUG] ❌ interact:stop error:", e);
    }
  });
}

module.exports = { registerInteractHandler };