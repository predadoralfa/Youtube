"use strict";

const db = require("../../models");
const { ensureRuntimeActorsForSpawns } = require("./runtimeActors");
const { buildActorPayload } = require("./payload");
const { attachContainersAndLoot } = require("./containers");
const { completeDuePrimitiveSheltersForInstance } = require("../buildProgressService");

async function loadActorsForInstance(instanceIdRaw, opts = {}) {
  const instanceId = Number(instanceIdRaw);
  if (!Number.isInteger(instanceId) || instanceId <= 0) {
    throw new Error(`loadActorsForInstance: invalid instanceId=${instanceIdRaw}`);
  }

  const includeContainers = opts.includeContainers !== false;
  const status = opts.status === undefined ? "ACTIVE" : opts.status;

  await completeDuePrimitiveSheltersForInstance(instanceId);

  return db.sequelize.transaction(async (tx) => {
    await ensureRuntimeActorsForSpawns(instanceId, tx);

    const where = { instance_id: instanceId };
    if (status != null) where.status = status;

    const actorRows = await db.GaActorRuntime.findAll({
      where,
      include: [
        {
          association: "actorDef",
          required: true,
        },
        {
          association: "spawn",
          required: false,
        },
      ],
      order: [["id", "ASC"]],
      transaction: tx,
    });

    const actors = actorRows.map(buildActorPayload);
    if (!includeContainers || actors.length === 0) return actors;

    return attachContainersAndLoot(actors, tx);
  });
}

module.exports = {
  loadActorsForInstance,
};
