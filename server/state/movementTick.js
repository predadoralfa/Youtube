// server/state/movementTick.js

const {
  getAllRuntimes,
  markRuntimeDirty,
} = require("./runtimeStore");

const {
  getRuntime, // usado pelo handleChunkTransition para spawn dos outros
} = require("./runtimeStore");

const {
  moveUserChunk,
  getUsersInChunks,
  getUsersInRoom,
  getInterestRoomsForUser,
  computeChunkFromPos,
} = require("./presenceIndex");

const { getActiveSocket } = require("../socket/sessionIndex");

const MOVEMENT_TICK_MS = 50; // 20Hz
const DT_MAX = 0.05;

let _timer = null;

function nowMs() {
  return Date.now();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function normalize2D(x, z) {
  const len = Math.hypot(x, z);
  if (len <= 0.00001) return { x: 0, z: 0 };
  return { x: x / len, z: z / len };
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
    return null;
  }

  return {
    x: clamp(pos.x, minX, maxX),
    y: pos.y,
    z: clamp(pos.z, minZ, maxZ),
  };
}

function readRuntimeSpeedStrict(runtime) {
  const n = Number(runtime?.speed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function bumpRev(rt) {
  const cur = Number(rt.rev ?? 0);
  rt.rev = Number.isFinite(cur) ? cur + 1 : 1;
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

function emitDeltaToInterest(io, socketOrNull, userId, payload) {
  const rooms = getInterestRoomsForUser(userId);
  for (const r of rooms) {
    // se tiver socket, evita eco no próprio jogador
    if (socketOrNull) socketOrNull.to(r).emit("entity:delta", payload);
    else io.to(r).emit("entity:delta", payload);
  }
}

function handleChunkTransition(io, socket, runtime, movedInfo) {
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
  if (!socket) return;

  // Para rooms que entraram: coletar usuários desses chunks e mandar spawn ao mover
  if (enteredRooms.size > 0) {
    const seen = new Set();

    for (const r of enteredRooms) {
      const s = getUsersInRoom(r);
      if (!s || s.size === 0) continue;

      for (const uid of s) {
        const id = String(uid);
        if (id === String(runtime.userId)) continue;
        if (seen.has(id)) continue;
        seen.add(id);

        const otherRt = getRuntime(id);
        if (!otherRt) continue;
        if (otherRt.connectionState === "OFFLINE") continue;

        socket.emit("entity:spawn", toEntity(otherRt));
      }
    }
  }

  // Para rooms que saíram: mandar despawn ao mover dos usuários nesses chunks
  if (leftRooms.size > 0) {
    const seen = new Set();

    const { cx, cz } = computeChunkFromPos(runtime.pos);
    const visibleNow = getUsersInChunks(runtime.instanceId, cx, cz);

    for (const r of leftRooms) {
      const s = getUsersInRoom(r);
      if (!s || s.size === 0) continue;

      for (const uid of s) {
        const id = String(uid);
        if (id === String(runtime.userId)) continue;
        if (seen.has(id)) continue;
        seen.add(id);

        if (visibleNow.has(id)) continue;

        const otherRt = getRuntime(id);
        const otherRev = Number(otherRt?.rev ?? 0);

        socket.emit("entity:despawn", { entityId: id, rev: otherRev });
      }
    }
  }
}

function tickOnce(io) {
  const t = nowMs();

  for (const rt of getAllRuntimes()) {
    if (!rt) continue;

    // ignora grace/offline: não “anda durante o pending”
    if (rt.connectionState === "DISCONNECTED_PENDING" || rt.connectionState === "OFFLINE") {
      continue;
    }

    if (rt.moveMode !== "CLICK") continue;
    if (!rt.moveTarget) continue;

    // dt server-side
    const last = Number(rt.moveTickAtMs ?? 0);
    const dtRaw = last > 0 ? (t - last) / 1000 : 0;
    const dt = clamp(dtRaw, 0, DT_MAX);
    rt.moveTickAtMs = t;

    // se dt 0, não vale gastar CPU com movimento
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
      rt.moveTarget = null;
      rt.moveMode = "STOP";
      if (rt.action !== "idle") rt.action = "idle";

      bumpRev(rt);
      markRuntimeDirty(rt.userId, t);

      const socket = getActiveSocket(rt.userId);
      const delta = {
        entityId: String(rt.userId),
        pos: rt.pos,
        yaw: rt.yaw,
        hp: rt.hp ?? 100,
        action: rt.action ?? "idle",
        rev: rt.rev ?? 0,
      };

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

    const moved =
      (clampedPos.x !== rt.pos.x) ||
      (clampedPos.z !== rt.pos.z);

    // yaw autoritativo apontando para a direção do deslocamento
    const newYaw = Math.atan2(dir.x, dir.z);
    const yawChanged = rt.yaw !== newYaw;

    if (!moved && !yawChanged) continue;

    rt.pos = clampedPos;
    rt.yaw = newYaw;
    rt.action = "move";

    bumpRev(rt);
    markRuntimeDirty(rt.userId, t);

    // ---- Chunk transition (precisa de socket pra join/leave + self-spawns) ----
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

    // ---- DELTA para outros ----
    const delta = {
      entityId: String(rt.userId),
      pos: rt.pos,
      yaw: rt.yaw,
      hp: rt.hp ?? 100,
      action: rt.action ?? "idle",
      rev: rt.rev ?? 0,
    };

    emitDeltaToInterest(io, socket, rt.userId, delta);

    // feedback local (opcional, mas mantém consistência com moveHandler)
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

function startMovementTick(io) {
  if (_timer) return;

  _timer = setInterval(() => {
    try {
      tickOnce(io);
    } catch (e) {
      console.error("[MOVE_TICK] error:", e);
    }
  }, MOVEMENT_TICK_MS);

  // não segura processo aberto em shutdown
  if (typeof _timer.unref === "function") _timer.unref();

  console.log(`[MOVE_TICK] started interval=${MOVEMENT_TICK_MS}ms`);
}

function stopMovementTick() {
  if (!_timer) return;
  clearInterval(_timer);
  _timer = null;
  console.log("[MOVE_TICK] stopped");
}

module.exports = {
  startMovementTick,
  stopMovementTick,
  MOVEMENT_TICK_MS,
};