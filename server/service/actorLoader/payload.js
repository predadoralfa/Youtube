"use strict";

const { mergeStateParts, toFiniteNumber } = require("./shared");

function buildActorPayload(actorRow) {
  const actor = actorRow.get({ plain: true });
  const actorDef = actor.actorDef ?? null;
  const spawn = actor.spawn ?? null;
  const mergedState = mergeStateParts(
    actorDef?.default_state_json ?? null,
    spawn?.state_override_json ?? null,
    actor.state_json ?? null
  );
  const displayName =
    mergedState?.displayName ??
    mergedState?.structureName ??
    actorDef?.name ??
    actorDef?.code ??
    `Actor ${actor.id}`;

  return {
    id: Number(actor.id),
    actorType: actorDef?.code ?? null,
    actorDefCode: actorDef?.code ?? null,
    actorKind: actorDef?.actor_kind ?? null,
    displayName,
    assetKey: actorDef?.asset_key ?? null,
    instanceId: Number(actor.instance_id),
    spawnId: actor.actor_spawn_id == null ? null : Number(actor.actor_spawn_id),
    pos: {
      x: toFiniteNumber(actor.pos_x, 0),
      y: toFiniteNumber(actor.pos_y, 0),
      z: toFiniteNumber(actor.pos_z, 0),
    },
    status: actor.status,
    rev: Number(actor.rev ?? 0),
    visualHint: actorDef?.visual_hint ?? null,
    state: Object.keys(mergedState).length > 0 ? mergedState : null,
    containers: [],
    lootSummary: null,
  };
}

module.exports = {
  buildActorPayload,
};
