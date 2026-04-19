"use strict";

const { markRuntimeDirty, markStatsDirty } = require("../../../runtimeStore");
const { getActiveSocket } = require("../../../../socket/sessionIndex");
const { bumpRev } = require("../../entity");
const { attemptCollectFromActor } = require("../../../../service/actorCollectService");
const { getActor } = require("../../../actorsRuntimeStore");
const { resolveActorCollectCooldownMs } = require("../../../../service/actorCollectService");
const { emitPlayerState } = require("./emitPlayerState");
const { syncRuntimeStamina } = require("../../stamina.js");

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

            if (result?.error === "CARRY_WEIGHT_LIMIT") {
              if (activeSocket) {
                activeSocket.emit("actor:collected", {
                  actorId: String(interactActorId),
                  actorDisabled: false,
                  inventory: result?.inventoryFull ?? null,
                  loot: null,
                  message: result?.message || "Carry weight limit reached",
                });
              }
            }

            if (result?.error === "INSUFFICIENT_STAMINA" || result?.error === "PLAYER_STATS_NOT_FOUND") {
              if (activeSocket) {
                activeSocket.emit("actor:collected", {
                  actorId: String(interactActorId),
                  actorDisabled: false,
                  inventory: null,
                  loot: null,
                  message: result?.message || "Not enough stamina to collect",
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

          if (result?.stamina && Number.isFinite(Number(result.stamina.after))) {
            syncRuntimeStamina(
              rt,
              Number(result.stamina.after),
              Number(result.stamina.max ?? result.stamina.after)
            );
            markStatsDirty(rt.userId);
          }

          if (!result?.actorDisabled && interactActorId != null) {
            const actor = getActor(String(interactActorId));
            if (actor) {
              resolveActorCollectCooldownMs(rt.userId, actor, rt.collectCooldownMs ?? null)
                .then((nextCooldownMs) => {
                  if (Number.isFinite(Number(nextCooldownMs)) && Number(nextCooldownMs) > 0) {
                    rt.collectCooldownMs = Number(nextCooldownMs);
                  }
                })
                .catch(() => {});
            }
          }

          if (activeSocket) {
            activeSocket.emit("actor:collected", {
              actorId: String(interactActorId),
              actorDisabled: result.actorDisabled,
              inventory: result.inventoryFull,
              loot: result.loot ?? null,
              xp: result.xp ?? null,
              actorUpdate: result.actorUpdate ?? null,
              message: result.message ?? null,
            });

            if (result.inventoryFull) {
              activeSocket.emit("inv:full", result.inventoryFull);
            }

            if (result.actorUpdate) {
              activeSocket.emit("actor:updated", {
                actorId: String(interactActorId),
                actor: result.actorUpdate,
              });
            }
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
