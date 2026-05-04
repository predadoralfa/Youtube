"use strict";

const { mergeStateParts, toFiniteNumber } = require("./shared");

function buildSceneObjectPayload(sceneObjectRow) {
  const sceneObject = sceneObjectRow.get({ plain: true });
  const sceneObjectDef = sceneObject.sceneObjectDef ?? null;
  const mergedState = mergeStateParts(
    sceneObjectDef?.default_state_json ?? null,
    sceneObject.state_json ?? null
  );
  const displayName =
    mergedState?.displayName ??
    sceneObjectDef?.name ??
    sceneObjectDef?.code ??
    `Scene Object ${sceneObject.id}`;

  return {
    id: Number(sceneObject.id),
    objectType: sceneObjectDef?.code ?? null,
    objectDefCode: sceneObjectDef?.code ?? null,
    displayName,
    assetKey: sceneObjectDef?.asset_key ?? null,
    category: sceneObjectDef?.category ?? null,
    instanceId: Number(sceneObject.instance_id),
    pos: {
      x: toFiniteNumber(sceneObject.pos_x, 0),
      y: toFiniteNumber(sceneObject.pos_y, 0),
      z: toFiniteNumber(sceneObject.pos_z, 0),
    },
    yaw: toFiniteNumber(sceneObject.yaw, 0),
    scale: {
      x: toFiniteNumber(sceneObject.scale_x, 1),
      y: toFiniteNumber(sceneObject.scale_y, 1),
      z: toFiniteNumber(sceneObject.scale_z, 1),
    },
    status: sceneObject.status,
    rev: Number(sceneObject.rev ?? 0),
    state: Object.keys(mergedState).length > 0 ? mergedState : null,
  };
}

module.exports = {
  buildSceneObjectPayload,
};
