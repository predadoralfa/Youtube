"use strict";

const { markRuntimeDirty } = require("../../../runtimeStore");
const { getActiveSocket } = require("../../../../socket/sessionIndex");
const { bumpRev } = require("../../entity");
const { attemptCollectFromActor } = require("../../../../service/actorCollectService");
const { emitPlayerState } = require("./emitPlayerState");

async function handleReachedTarget(io, rt, t, processAutomaticCombat) {
  if (rt.interact?.active && rt.interact?.kind === "ACTOR") {
    const lastCollect = rt.lastActorCollectAtMs ?? 0;
    const collectCooldown = rt.collectCooldownMs ?? 1000;

    if (t >= lastCollect + collectCooldown) {
      rt.lastActorCollectAtMs = t;
      const interactActorId = rt.interact?.id ?? null;

      attemptCollectFromActor(rt.userId, interactActorId)
        .then((result) => {
          const activeSocket = getActiveSocket(rt.userId);
          const roomName = rt.instanceId != null ? `inst:${Number(rt.instanceId)}` : null;

          if (!result?.ok) {
            if (result?.error === "ACTOR_NOT_FOUND") {
              rt.interact = null;
              rt.moveTarget = null;
              rt.moveMode = "STOP";
              rt.action = "idle";

              if (activeSocket) {
                activeSocket.emit("actor:collected", {
                  actorId: String(interactActorId),
                  actorDisabled: true,
                  inventory: null,
                  loot: null,
                });
              }
            }

            if (result?.error === "ACTOR_LOOT_EMPTY") {
              if (activeSocket) {
                activeSocket.emit("actor:collected", {
                  actorId: String(interactActorId),
                  actorDisabled: false,
                  inventory: null,
                  loot: null,
                  message: result?.message || "This resource has no items right now",
                });
              }
            }

            console.warn(
              `[COLLECT] Erro ao coletar: userId=${rt.userId} actorId=${interactActorId} error=${result?.error}`
            );
            return;
          }

          if (result.actorDisabled) {
            rt.interact = null;
            rt.moveTarget = null;
            rt.moveMode = "STOP";
            rt.action = "idle";
          }

          if (activeSocket) {
            activeSocket.emit("actor:collected", {
              actorId: String(interactActorId),
              actorDisabled: result.actorDisabled,
              inventory: result.inventoryFull,
              loot: result.loot ?? null,
              actorUpdate: result.actorUpdate ?? null,
              message: result.message ?? null,
            });
          }

          if (result?.actorUpdate && roomName && activeSocket) {
            activeSocket.broadcast.to(roomName).emit("actor:updated", {
              actorId: String(interactActorId),
              actor: result.actorUpdate,
            });
          }
        })
        .catch((err) => {
          console.error(
            `[COLLECT] Erro ao coletar: userId=${rt.userId} actorId=${interactActorId}`,
            err
          );
        });
    }
  } else if (rt.combat?.state === "ENGAGED" && rt.combat?.targetKind === "ENEMY") {
    rt.action = "move";
    await processAutomaticCombat(io, rt, t);
  } else {
    rt.moveTarget = null;
    rt.moveMode = "STOP";
    if (rt.action !== "idle") rt.action = "idle";
  }

  if (rt.combat?.state === "ENGAGED" && rt.combat?.targetKind === "ENEMY") {
    return true;
  }

  bumpRev(rt);
  markRuntimeDirty(rt.userId, t);
  await emitPlayerState(io, rt);
  return false;
}

module.exports = {
  handleReachedTarget,
};
