// server/socket/handlers/world/join.js

const { ensureRuntimeLoaded, getRuntime } = require("../../../state/runtimeStore");
const { addUserToInstance } = require("../../../state/presenceIndex");

const { buildRooms, applyRooms } = require("./rooms");
const { buildBaseline } = require("./baseline");

/**
 * Fluxo autoritativo de world:join (idempotente no presenceIndex).
 */
async function handleWorldJoin({ socket }) {
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

  return { rt, baseline };
}

module.exports = {
  handleWorldJoin,
};