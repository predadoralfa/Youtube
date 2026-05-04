"use strict";

const db = require("../../models");

async function resolveSceneObjectDef(params, tx) {
  const sceneObjectDefId = Number(params?.sceneObjectDefId);
  const sceneObjectDefCode = String(
    params?.sceneObjectDefCode ??
      params?.objectDefCode ??
      params?.objectType ??
      ""
  ).trim();

  if (Number.isInteger(sceneObjectDefId) && sceneObjectDefId > 0) {
    const sceneObjectDef = await db.GaSceneObjectDef.findByPk(sceneObjectDefId, { transaction: tx });
    if (!sceneObjectDef) {
      throw new Error(`resolveSceneObjectDef: ga_scene_object_def not found id=${sceneObjectDefId}`);
    }
    return sceneObjectDef;
  }

  if (!sceneObjectDefCode) {
    throw new Error("resolveSceneObjectDef: sceneObjectDefId or sceneObjectDefCode required");
  }

  const sceneObjectDef = await db.GaSceneObjectDef.findOne({
    where: { code: sceneObjectDefCode },
    transaction: tx,
  });

  if (!sceneObjectDef) {
    throw new Error(`resolveSceneObjectDef: ga_scene_object_def not found code=${sceneObjectDefCode}`);
  }

  return sceneObjectDef;
}

module.exports = {
  resolveSceneObjectDef,
};
