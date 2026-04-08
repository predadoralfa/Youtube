"use strict";

const db = require("../../models");

async function resolveActorDef(params, tx) {
  const actorDefId = Number(params?.actorDefId);
  const actorDefCode = String(
    params?.actorDefCode ??
      params?.actorType ??
      ""
  ).trim();

  if (Number.isInteger(actorDefId) && actorDefId > 0) {
    const actorDef = await db.GaActorDef.findByPk(actorDefId, { transaction: tx });
    if (!actorDef) {
      throw new Error(`resolveActorDef: ga_actor_def not found id=${actorDefId}`);
    }
    return actorDef;
  }

  if (!actorDefCode) {
    throw new Error("resolveActorDef: actorDefId or actorDefCode required");
  }

  const actorDef = await db.GaActorDef.findOne({
    where: { code: actorDefCode },
    transaction: tx,
  });

  if (!actorDef) {
    throw new Error(`resolveActorDef: ga_actor_def not found code=${actorDefCode}`);
  }

  return actorDef;
}

module.exports = {
  resolveActorDef,
};
