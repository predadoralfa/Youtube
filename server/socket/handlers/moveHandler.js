// server/socket/handlers/moveHandler.js
const {
  getRuntime,
  ensureRuntimeLoaded,
  markRuntimeDirty,
  // (NOVO) regra única para “WASD ativo”, com timeout
  isWASDActive,
} = require("../../state/runtimeStore");

const {
  moveUserChunk,
  getUsersInChunks,
  getUsersInRoom,
  getInterestRoomsForUser,
  computeChunkFromPos,
} = require("../../state/presenceIndex");

const DT_MAX = 0.05;
const MOVES_PER_SEC = 60;

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function normalize2D(x, z) {
  const len = Math.hypot(x, z);
  if (len <= 0.00001) return { x: 0, z: 0 };
  return { x: x / len, z: z / len };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function clampPosToBounds(pos, bounds) {
  const minX = Number(bounds?.minX);
  const maxX = Number(bounds?.maxX);
  const minZ = Number(bounds?.minZ);
  const maxZ = Number(bounds?.maxZ);

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(minZ) ||
    !Number.isFinite(maxZ)
  ) {
    return null; // bounds inválido => bloqueia movimento
  }

  return {
    x: clamp(pos.x, minX, maxX),
    y: pos.y,
    z: clamp(pos.z, minZ, maxZ),
  };
}

function allowMove(runtime, nowMs) {
  const minInterval = 1000 / MOVES_PER_SEC;
  if (runtime.lastMoveAtMs && nowMs - runtime.lastMoveAtMs < minInterval) return false;
  runtime.lastMoveAtMs = nowMs;
  return true;
}

// ❌ sem default: se der ruim, não move
function readRuntimeSpeedStrict(runtime) {
  const n = Number(runtime?.speed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function toEntity(rt) {
  return {
    entityId: String(rt.userId),
    displayName: rt.displayName ?? null,
    pos: rt.pos,
    yaw: rt.yaw,
    hp: rt.hp ?? 100,
    action: rt.action ?? "idle",
    rev: rt.rev ?? 0,
  };
}

function bumpRev(rt) {
  // rev monotônico por entidade
  const cur = Number(rt.rev ?? 0);
  rt.rev = Number.isFinite(cur) ? cur + 1 : 1;
}

function emitDeltaToInterest(socket, userId, payload) {
  const rooms = getInterestRoomsForUser(userId);
  for (const r of rooms) {
    socket.to(r).emit("entity:delta", payload);
  }
}

function handleChunkTransition(socket, runtime, movedInfo) {
  const io = socket.server; // socket.io Server
  const selfEntity = toEntity(runtime);

  const enteredRooms = movedInfo?.diff?.entered ?? new Set();
  const leftRooms = movedInfo?.diff?.left ?? new Set();

  // ---- A) Outros veem você (broadcast por room) ----
  for (const r of enteredRooms) {
    io.to(r).emit("entity:spawn", selfEntity);
  }
  for (const r of leftRooms) {
    io.to(r).emit("entity:despawn", {
      entityId: selfEntity.entityId,
      rev: selfEntity.rev,
    });
  }

  // ---- B) Você vê outros (envios diretos para o socket mover) ----

  // Para rooms que entraram: coletar usuários desses chunks e mandar spawn ao mover
  if (enteredRooms.size > 0) {
    const seen = new Set();

    for (const r of enteredRooms) {
      const s = getUsersInRoom(r); // cópia segura
      if (!s || s.size === 0) continue;

      for (const uid of s) {
        const id = String(uid);
        if (id === String(runtime.userId)) continue;
        if (seen.has(id)) continue;
        seen.add(id);

        const otherRt = getRuntime(id);
        if (!otherRt) continue;

        // opcional: não spawnar OFFLINE
        if (otherRt.connectionState === "OFFLINE") continue;

        socket.emit("entity:spawn", toEntity(otherRt));
      }
    }
  }

  // Para rooms que saíram: mandar despawn ao mover dos usuários nesses chunks
  if (leftRooms.size > 0) {
    const seen = new Set();

    // visibilidade atual agregada por interest (evita despawn em overlap)
    const { cx, cz } = computeChunkFromPos(runtime.pos);
    const visibleNow = getUsersInChunks(runtime.instanceId, cx, cz);

    for (const r of leftRooms) {
      const s = getUsersInRoom(r); // cópia segura
      if (!s || s.size === 0) continue;

      for (const uid of s) {
        const id = String(uid);
        if (id === String(runtime.userId)) continue;
        if (seen.has(id)) continue;
        seen.add(id);

        // se ainda está visível no novo interest, não despawn
        if (visibleNow.has(id)) continue;

        const otherRt = getRuntime(id);
        const otherRev = Number(otherRt?.rev ?? 0);

        socket.emit("entity:despawn", { entityId: id, rev: otherRev });
      }
    }
  }
}

function registerMoveHandler(socket) {
  socket.on("move:intent", async (payload) => {
    try {
      const userId = socket.data.userId;
      const nowMs = Date.now();

      await ensureRuntimeLoaded(userId);

      const runtime = getRuntime(userId);
      if (!runtime) return;

      // ✅ blindagem: se caiu / está pendente / offline, ignora intent
      if (
        runtime.connectionState === "DISCONNECTED_PENDING" ||
        runtime.connectionState === "OFFLINE"
      ) {
        return;
      }

      if (!allowMove(runtime, nowMs)) return;

      const dir = payload?.dir;
      const yawDesired = payload?.yawDesired;

      if (!dir || !isFiniteNumber(dir.x) || !isFiniteNumber(dir.z)) return;

      // dt autoritativo do servidor (não confia no client)
      const last = Number(runtime.wasdTickAtMs ?? 0);
      const dt = clamp(((nowMs - (last > 0 ? last : nowMs)) / 1000), 0, DT_MAX);
      runtime.wasdTickAtMs = nowMs;

      // yaw vem da camera (se veio)
      let yawChanged = false;
      if (isFiniteNumber(yawDesired)) {
        const y = Math.atan2(Math.sin(yawDesired), Math.cos(yawDesired));
        if (runtime.yaw !== y) {
          runtime.yaw = y;
          yawChanged = true;
        }
      }

      // direção normalizada
      const d = normalize2D(dir.x, dir.z);

      // ==============================
      // (NOVO) Sempre atualizar estado de input
      // ==============================
      runtime.inputDir = d;
      runtime.inputDirAtMs = nowMs;

      // ==============================
      // (NOVO) Regras de prioridade: WASD cancela CLICK
      // ==============================
      const wasdActiveNow = isWASDActive(runtime, nowMs); // usa timeout interno

      let modeOrActionChanged = false;

      if (wasdActiveNow) {
        if (runtime.moveMode === "CLICK") {
          runtime.moveTarget = null;
          runtime.moveMode = "WASD";
          modeOrActionChanged = true;
        } else if (runtime.moveMode !== "WASD") {
          runtime.moveMode = "WASD";
          modeOrActionChanged = true;
        }

        // coerência de action (mínimo)
        if (runtime.action !== "move") {
          runtime.action = "move";
          modeOrActionChanged = true;
        }
      } else {
        // sem input efetivo recente
        if (runtime.moveMode === "WASD") {
          runtime.moveMode = "STOP";
          modeOrActionChanged = true;
        }
        if (d.x === 0 && d.z === 0) {
          if (runtime.action !== "idle") {
            runtime.action = "idle";
            modeOrActionChanged = true;
          }
        }
      }

      const speed = readRuntimeSpeedStrict(runtime);
      if (speed == null) {
        console.error("[MOVE] runtime.speed inválido/ausente", {
          userId,
          runtimeSpeed: runtime?.speed,
        });
        return;
      }

      let moved = false;

      // Só tenta mover se houver direção não-nula
      if (!(d.x === 0 && d.z === 0)) {
        // sem fallback: bounds é obrigatório para movimento
        if (!runtime.bounds) {
          console.error("[MOVE] runtime.bounds ausente (bloqueando movimento)", { userId });
          return;
        }

        const desired = {
          x: runtime.pos.x + d.x * speed * dt,
          y: runtime.pos.y,
          z: runtime.pos.z + d.z * speed * dt,
        };

        const clampedPos = clampPosToBounds(desired, runtime.bounds);
        if (!clampedPos) {
          console.error("[MOVE] runtime.bounds inválido (bloqueando movimento)", {
            userId,
            bounds: runtime.bounds,
          });
          return;
        }

        // só marca moved se mudou de fato (bater na borda pode impedir)
        if (clampedPos.x !== runtime.pos.x || clampedPos.z !== runtime.pos.z) {
          runtime.pos = clampedPos;
          moved = true;
        }
      }

      // ✅ se nada mudou, mas modo/action mudou, ainda precisa replicar
      if (!moved && !yawChanged && !modeOrActionChanged) return;

      // rev monotônico sempre que algo muda (pos ou yaw ou action/mode)
      bumpRev(runtime);

      // ✅ hot path não toca DB: só marca dirty em memória
      markRuntimeDirty(userId, nowMs);

      // ---- Chunk detect + presença ----
      const { cx, cz } = computeChunkFromPos(runtime.pos);

      const prevCx = Number(runtime.chunk?.cx);
      const prevCz = Number(runtime.chunk?.cz);
      const chunkChanged = prevCx !== cx || prevCz !== cz;

      let movedInfo = null;
      if (chunkChanged) {
        movedInfo = moveUserChunk(userId, cx, cz);

        // atualiza runtime.chunk (fonte de verdade local do servidor)
        runtime.chunk = { cx, cz };

        // join/leave de rooms do socket (autoritativo por diffs)
        if (movedInfo?.diff?.entered) {
          for (const r of movedInfo.diff.entered) socket.join(r);
        }
        if (movedInfo?.diff?.left) {
          for (const r of movedInfo.diff.left) socket.leave(r);
        }

        // spawn/despawn (tanto para outros quanto para o mover)
        if (movedInfo) {
          handleChunkTransition(socket, runtime, movedInfo);
        }
      }

      // ---- DELTA para outros (por interest) ----
      const delta = {
        entityId: String(runtime.userId),
        pos: runtime.pos,
        yaw: runtime.yaw,
        hp: runtime.hp ?? 100,
        action: runtime.action ?? "idle",
        rev: runtime.rev ?? 0,
      };

      emitDeltaToInterest(socket, userId, delta);

      // feedback local
      socket.emit("move:state", {
        entityId: String(runtime.userId),
        pos: runtime.pos,
        yaw: runtime.yaw,
        rev: runtime.rev ?? 0,
        chunk: runtime.chunk ?? { cx, cz },
      });
    } catch (e) {
      console.error("[MOVE] error:", e);
    }
  });
}

module.exports = { registerMoveHandler };