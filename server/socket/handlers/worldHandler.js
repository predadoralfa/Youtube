// server/socket/handlers/worldHandler.js
//
// Responsável por:
// - world:join
// - world:resync
// - baseline autoritativo
// - cálculo de interest (chunk rooms)
// - join/leave de rooms
//
// Regras:
// - Cliente não escolhe chunk nem entidade
// - Sempre existe baseline
// - Não tocar DB no hot path para terceiros (apenas self pode ensureRuntimeLoaded)
// - NÃO deve reintroduzir OFFLINE no mundo

const { getRuntime, ensureRuntimeLoaded } = require("../../state/runtimeStore");

const {
  addUserToInstance,
  moveUserChunk,
  getUsersInChunks,
  computeChunkFromPos,
} = require("../../state/presenceIndex");

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

function getSocketJoinedRooms(socket) {
  const out = new Set();
  for (const r of socket.rooms) {
    if (r === socket.id) continue;
    out.add(r);
  }
  return out;
}

function applyRooms(socket, targetRooms) {
  const current = getSocketJoinedRooms(socket);

  for (const r of current) {
    if (!targetRooms.has(r)) socket.leave(r);
  }
  for (const r of targetRooms) {
    if (!current.has(r)) socket.join(r);
  }
}

function buildRooms(instanceId, interestRoomsSet) {
  const rooms = new Set();
  rooms.add(`inst:${instanceId}`);
  for (const r of interestRoomsSet) rooms.add(r);
  return rooms;
}

function computeInterestFromRuntime(rt) {
  return computeChunkFromPos(rt.pos);
}

/**
 * Baseline autoritativo "amigável pro front":
 * - you: entidade completa do self
 * - others: lista sem self
 */
function buildBaseline(rt) {
  const { cx, cz } = computeInterestFromRuntime(rt);

  const you = toEntity(rt);

  const visibleUserIds = getUsersInChunks(rt.instanceId, cx, cz);

  const others = [];
  for (const uid of visibleUserIds) {
    const other = getRuntime(uid);
    if (!other) continue;

    if (other.connectionState === "OFFLINE") continue;

    const e = toEntity(other);
    if (e.entityId === you.entityId) continue; // ✅ remove self do array
    others.push(e);
  }

  return {
    instanceId: String(rt.instanceId),
    you,
    chunk: { cx, cz },
    others,
  };
}

function registerWorldHandler(io, socket) {
  socket.on("world:join", async (_payload, ack) => {
    try {
      const userId = socket.data.userId;

      await ensureRuntimeLoaded(userId);
      const rt = getRuntime(userId);
      if (!rt) throw new Error("RUNTIME_NOT_LOADED");

      if (rt.connectionState === "OFFLINE") {
        throw new Error("CANNOT_JOIN_OFFLINE");
      }

      // Indexa presença (idempotente)
      const info = addUserToInstance(userId, rt.instanceId, rt.pos);

      // Rooms autoritativas (inst + chunks do interest)
      const targetRooms = buildRooms(String(rt.instanceId), info.interestRooms);
      applyRooms(socket, targetRooms);

      socket.data.instanceId = String(rt.instanceId);
      socket.data._worldJoined = true;

      // Baseline obrigatório
      const baseline = buildBaseline(rt);
      socket.emit("world:baseline", {
        ok: true,
        ...baseline,
        t: Date.now(),
      });

      if (typeof ack === "function") {
        ack({
          ok: true,
          instanceId: String(rt.instanceId),
          youId: String(rt.userId),
          cx: baseline.chunk.cx,
          cz: baseline.chunk.cz,
        });
      }
    } catch (err) {
      if (typeof ack === "function") {
        ack({ ok: false, error: String(err?.message || err) });
      }
    }
  });

  socket.on("world:resync", async (_payload, ack) => {
    try {
      const userId = socket.data.userId;

      await ensureRuntimeLoaded(userId);
      const rt = getRuntime(userId);
      if (!rt) throw new Error("RUNTIME_NOT_LOADED");

      if (rt.connectionState === "OFFLINE") {
        throw new Error("CANNOT_RESYNC_OFFLINE");
      }

      const { cx, cz } = computeInterestFromRuntime(rt);

      // Atualiza presença/chunk
      const moved = moveUserChunk(userId, cx, cz);

      // Se não havia index, cria
      const info = moved ? moved.next : addUserToInstance(userId, rt.instanceId, rt.pos);

      const interestRooms = moved ? moved.next.interestRooms : info.interestRooms;
      const targetRooms = buildRooms(String(rt.instanceId), interestRooms);
      applyRooms(socket, targetRooms);

      socket.data.instanceId = String(rt.instanceId);
      socket.data._worldJoined = true;

      const baseline = buildBaseline(rt);
      socket.emit("world:baseline", {
        ok: true,
        ...baseline,
        t: Date.now(),
      });

      if (typeof ack === "function") {
        ack({
          ok: true,
          instanceId: String(rt.instanceId),
          youId: String(rt.userId),
          cx: baseline.chunk.cx,
          cz: baseline.chunk.cz,
        });
      }
    } catch (err) {
      if (typeof ack === "function") {
        ack({ ok: false, error: String(err?.message || err) });
      }
    }
  });
}

module.exports = { registerWorldHandler };