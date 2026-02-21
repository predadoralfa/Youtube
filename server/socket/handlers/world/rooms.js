// server/socket/handlers/world/rooms.js

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

module.exports = {
  getSocketJoinedRooms,
  applyRooms,
  buildRooms,
};