// server/state/presence/keys.js

function toUserKey(userId) {
  return String(userId);
}

function roomKey(instanceId, cx, cz) {
  return `chunk:${instanceId}:${cx}:${cz}`;
}

module.exports = {
  toUserKey,
  roomKey,
};