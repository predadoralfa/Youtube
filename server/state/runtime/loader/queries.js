"use strict";

const db = require("../../../models");
const { sanitizeSpeed } = require("./shared");

async function loadSpeedFromStats(userId) {
  const stats = await db.GaUserStats.findOne({
    where: { user_id: userId },
    attributes: ["user_id", "move_speed"],
  });

  return sanitizeSpeed(stats?.move_speed);
}

async function loadBoundsForInstance(instanceId) {
  const inst = await db.GaInstance.findByPk(instanceId, {
    attributes: ["id", "local_id"],
    include: [
      {
        model: db.GaLocal,
        as: "local",
        attributes: ["id"],
        include: [
          {
            model: db.GaLocalGeometry,
            as: "geometry",
            attributes: ["size_x", "size_z"],
          },
        ],
      },
    ],
  });

  const sizeX = Number(inst?.local?.geometry?.size_x);
  const sizeZ = Number(inst?.local?.geometry?.size_z);

  if (!Number.isFinite(sizeX) || sizeX <= 0 || !Number.isFinite(sizeZ) || sizeZ <= 0) {
    throw new Error(
      `Bounds invalido no DB (GaLocalGeometry) instance=${instanceId} local=${inst?.local?.id ?? "?"} sizeX=${sizeX} sizeZ=${sizeZ}`
    );
  }

  return {
    minX: -sizeX / 2,
    maxX: sizeX / 2,
    minZ: -sizeZ / 2,
    maxZ: sizeZ / 2,
    sizeX,
    sizeZ,
  };
}

async function loadRuntimeRow(userId) {
  return db.GaUserRuntime.findOne({
    where: { user_id: userId },
    attributes: [
      "user_id",
      "instance_id",
      "pos_x",
      "pos_y",
      "pos_z",
      "yaw",
      "camera_pitch",
      "camera_distance",
      "connection_state",
      "disconnected_at",
      "offline_allowed_at",
    ],
  });
}

module.exports = {
  loadSpeedFromStats,
  loadBoundsForInstance,
  loadRuntimeRow,
};
