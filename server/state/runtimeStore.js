// server/state/runtimeStore.js
const db = require("../models");

const runtimeStore = new Map(); // key: userId -> runtime state

function getRuntime(userId) {
  return runtimeStore.get(String(userId)) || null;
}

function setRuntime(userId, runtime) {
  runtimeStore.set(String(userId), runtime);
}

async function ensureRuntimeLoaded(userId) {
  const key = String(userId);
  if (runtimeStore.has(key)) return runtimeStore.get(key);

  const row = await db.GaUserRuntime.findOne({
    where: { user_id: userId },
    attributes: ["user_id", "instance_id", "pos_x", "pos_y", "pos_z", "yaw"],
  });

  if (!row) {
    throw new Error("Runtime ausente no banco (ga_user_runtime)");
  }

  const runtime = {
    userId: row.user_id,
    instanceId: row.instance_id,
    pos: {
      x: Number(row.pos_x ?? 0),
      y: Number(row.pos_y ?? 0),
      z: Number(row.pos_z ?? 0),
    },
    yaw: Number(row.yaw ?? 0),
    dirty: false,

    // anti-flood
    lastMoveAtMs: 0,
    moveCountWindow: 0,
    moveWindowStartMs: 0,
  };

  runtimeStore.set(key, runtime);
  return runtime;
}

module.exports = {
  runtimeStore,
  getRuntime,
  setRuntime,
  ensureRuntimeLoaded,
};
