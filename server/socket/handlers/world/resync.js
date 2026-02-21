// server/socket/handlers/world/resync.js

const { ensureRuntimeLoaded, getRuntime } = require("../../../state/runtimeStore");
const { addUserToInstance, moveUserChunk } = require("../../../state/presenceIndex");

const { buildRooms, applyRooms } = require("./rooms");
const { buildBaseline } = require("./baseline");
const { computeInterestFromRuntime } = require("./interest");

/**
 * Fluxo autoritativo de world:resync.
 * - Recalcula interest do runtime
 * - Atualiza presenceIndex/chunk
 * - Reaplica rooms e emite baseline
 */
async function handleWorldResync({ socket }) {
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

  return { rt, baseline };
}

module.exports = {
  handleWorldResync,
};