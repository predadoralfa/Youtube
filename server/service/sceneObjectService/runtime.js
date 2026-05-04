"use strict";

const db = require("../../models");
const { toFiniteNumber } = require("./shared");
const { resolveSceneObjectDef } = require("./defs");

async function createRuntimeSceneObject(params) {
  const instanceId = Number(params?.instanceId);
  const posX = toFiniteNumber(params?.posX, 0);
  const posY = toFiniteNumber(params?.posY, 0);
  const posZ = toFiniteNumber(params?.posZ, 0);
  const yaw = toFiniteNumber(params?.yaw, 0);
  const scaleX = toFiniteNumber(params?.scaleX, 1);
  const scaleY = toFiniteNumber(params?.scaleY, 1);
  const scaleZ = toFiniteNumber(params?.scaleZ, 1);
  const stateJson = params?.stateJson ?? null;
  const status = String(params?.status || "ACTIVE").toUpperCase();
  const rev = Number.isFinite(Number(params?.rev)) ? Number(params.rev) : 1;

  if (!Number.isInteger(instanceId) || instanceId <= 0) {
    throw new Error("createRuntimeSceneObject: instanceId invalid");
  }

  if (status !== "ACTIVE" && status !== "DISABLED") {
    throw new Error("createRuntimeSceneObject: status invalid");
  }

  const run = async (tx) => {
    const sceneObjectDef = await resolveSceneObjectDef(params, tx);
    const instance = await db.GaInstance.findByPk(instanceId, { transaction: tx });
    if (!instance) {
      throw new Error(`createRuntimeSceneObject: ga_instance not found id=${instanceId}`);
    }

    const sceneObject = await db.GaSceneObject.create(
      {
        scene_object_def_id: sceneObjectDef.id,
        instance_id: instanceId,
        pos_x: posX,
        pos_y: posY,
        pos_z: posZ,
        yaw,
        scale_x: scaleX,
        scale_y: scaleY,
        scale_z: scaleZ,
        state_json: stateJson,
        status,
        rev,
      },
      { transaction: tx }
    );

    return { sceneObject, sceneObjectDef };
  };

  if (params?.transaction) {
    return run(params.transaction);
  }

  return db.sequelize.transaction((tx) => run(tx));
}

module.exports = {
  createRuntimeSceneObject,
};
