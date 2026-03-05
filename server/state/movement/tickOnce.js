// server/state/movement/tickOnce.js

const { getAllRuntimes, markRuntimeDirty } = require("../runtimeStore");
const { moveUserChunk, computeChunkFromPos } = require("../presenceIndex");
const { getActiveSocket } = require("../../socket/sessionIndex");

const { DT_MAX } = require("./config");
const { computeDtSeconds, normalize2D, clampPosToBounds, readRuntimeSpeedStrict } = require("./math");
const { bumpRev, toDelta } = require("./entity");
const { emitDeltaToInterest } = require("./emit");
const { handleChunkTransition } = require("./chunkTransition");

// ✅ NOVO: coleta de actors
const { attemptCollectFromActor } = require("../../service/actorCollectService");

/**
 * Um tick de movimento (processa CLICK-to-move).
 * Mantém exatamente o comportamento do arquivo original.
 */
function tickOnce(io, nowMsValue) {
  const t = nowMsValue;

  for (const rt of getAllRuntimes()) {
    if (!rt) continue;

    // ignora grace/offline: não “anda durante o pending”
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
      } else {
        // ================================================================
        // SE NÃO ESTÁ EM INTERACT LOOP: PARA NORMALMENTE
        // ================================================================
        rt.moveTarget = null;
        rt.moveMode = "STOP";
        if (rt.action !== "idle") rt.action = "idle";
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
  }
}

module.exports = {
  tickOnce,
};