"use strict";

const db = require("../../models");
const { buildSceneObjectPayload } = require("./payload");

function isMissingSceneObjectTableError(error) {
  const code = error?.original?.code ?? error?.parent?.code ?? error?.code ?? null;
  const errno = error?.original?.errno ?? error?.parent?.errno ?? error?.errno ?? null;
  return code === "ER_NO_SUCH_TABLE" || errno === 1146;
}

async function loadSceneObjectsForInstance(instanceIdRaw, opts = {}) {
  const instanceId = Number(instanceIdRaw);
  if (!Number.isInteger(instanceId) || instanceId <= 0) {
    throw new Error(`loadSceneObjectsForInstance: invalid instanceId=${instanceIdRaw}`);
  }

  const status = opts.status === undefined ? "ACTIVE" : opts.status;

  const where = { instance_id: instanceId };
  if (status != null) where.status = status;

  let rows;
  try {
    rows = await db.GaSceneObject.findAll({
      where,
      include: [
        {
          association: "sceneObjectDef",
          required: true,
        },
      ],
      order: [["id", "ASC"]],
    });
  } catch (error) {
    if (isMissingSceneObjectTableError(error)) {
      console.warn(
        `[sceneObjectLoader] Missing scene object tables; returning empty list for instanceId=${instanceId}`
      );
      return [];
    }

    throw error;
  }

  return rows.map(buildSceneObjectPayload);
}

module.exports = {
  loadSceneObjectsForInstance,
};
