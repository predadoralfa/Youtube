"use strict";

const { markRuntimeDirty, markStatsDirty } = require("../../../runtimeStore");
const { getActiveSocket } = require("../../../../socket/sessionIndex");
const { bumpRev } = require("../../entity");
const { attemptCollectFromActor } = require("../../../../service/actorCollectService");
const { getActor } = require("../../../actorsRuntimeStore");
const db = require("../../../../models");
const { withInventoryLock } = require("../../../inventory/store");
const { ensureInventoryLoaded } = require("../../../inventory/loader");
const { ensureEquipmentLoaded } = require("../../../equipment/loader");
const { buildInventoryFull } = require("../../../inventory/fullPayload");
const { startPrimitiveShelterConstruction } = require("../../../../service/buildService");
const { resolveActorCollectCooldownMs } = require("../../../../service/actorCollectService");
const { emitPlayerState } = require("./emitPlayerState");
const { syncRuntimeStamina } = require("../../stamina.js");
const { drinkFromRiverSource } = require("../../../../service/waterSourceService");
const {
  canStartPrimitiveShelterSleep,
  startPrimitiveShelterSleep,
} = require("../../../../service/primitiveShelterSleepService");
const { stopMovement } = require("../../input");

async function handleReachedTarget(io, rt, t, processAutomaticCombat) {
  if (rt.interact?.active && rt.interact?.kind === "ACTOR") {
    const interactActorId = rt.interact?.id ?? null;
    const pendingBuildActorId = rt.pendingBuild?.actorId ?? null;
    const pendingSleepActorId = rt.pendingSleep?.actorId ?? null;
    console.log("[BUILD][SERVER] reached target", {
      userId: rt.userId,
      interactActorId,
      pendingBuildActorId,
      pendingSleepActorId,
    });

    if (pendingSleepActorId != null && String(pendingSleepActorId) === String(interactActorId)) {
      try {
        if (!canStartPrimitiveShelterSleep(rt, 50)) {
          rt.pendingSleep = null;
          rt.interact = null;
          stopMovement(rt, { nowMs: t });
          rt.action = "idle";
          bumpRev(rt);
          markRuntimeDirty(rt.userId, t);
          await emitPlayerState(io, rt);
          return true;
        }

        startPrimitiveShelterSleep(rt, interactActorId, t);
        bumpRev(rt);
        markRuntimeDirty(rt.userId, t);
        await emitPlayerState(io, rt);
      } catch (err) {
        console.error(
          `[SLEEP] failed to start sleep: userId=${rt.userId} actorId=${interactActorId}`,
          err
        );
      }
      return true;
    }

    if (pendingBuildActorId != null && String(pendingBuildActorId) === String(interactActorId)) {
      try {
        await withInventoryLock(rt.userId, async () => {
          console.log("[BUILD][SERVER] auto start begin", {
            userId: rt.userId,
            actorId: interactActorId,
          });
          const invRt = await ensureInventoryLoaded(rt.userId);
          const eqRt = await ensureEquipmentLoaded(rt.userId);
          const tx = await db.sequelize.transaction();
          try {
            const result = await startPrimitiveShelterConstruction({
              userId: rt.userId,
              actorId: interactActorId,
              tx,
              inventoryRuntime: invRt,
              equipmentRuntime: eqRt,
            });

            if (!result?.ok) {
              await tx.rollback().catch(() => {});
              console.warn("[BUILD][SERVER] auto start rejected", {
                userId: rt.userId,
                actorId: interactActorId,
                code: result?.code ?? null,
                message: result?.message ?? null,
              });
              return;
            }

            await tx.commit();
            console.log("[BUILD][SERVER] auto start completed", {
              userId: rt.userId,
              actorId: interactActorId,
              instanceId: rt.instanceId,
              rev: result.rev ?? null,
            });

            rt.pendingBuild = null;
            rt.buildLock = {
              active: true,
              actorId: String(interactActorId),
            };
            rt.interact = null;
            stopMovement(rt, { nowMs: t });
            rt.action = "idle";

            const activeSocket = getActiveSocket(rt.userId);
            if (activeSocket) {
              activeSocket.emit("inv:full", buildInventoryFull(invRt, eqRt));
              activeSocket.emit("actor:updated", {
                actorId: String(interactActorId),
                actor: result.actorPayload,
              });
            }

            bumpRev(rt);
            markRuntimeDirty(rt.userId, t);
            await emitPlayerState(io, rt);
          } catch (error) {
            await tx.rollback().catch(() => {});
            throw error;
          }
        });
      } catch (err) {
        console.error(
          `[BUILD] failed to start construction: userId=${rt.userId} actorId=${interactActorId}`,
          err
        );
      }
      return true;
    }

    const actor = getActor(String(interactActorId));
    const actorDefCode = String(
      actor?.actorDef?.code ??
      actor?.actorDefCode ??
      actor?.actorType ??
      actor?.actor_type ??
      ""
    ).trim().toUpperCase();
    if (actorDefCode === "RIVER_PATCH") {
      try {
        const drinkResult = drinkFromRiverSource(rt, actor, t);
        const thirstCurrent = Number(drinkResult?.thirstCurrent ?? 0);
        const thirstMax = Number(drinkResult?.thirstMax ?? 0);
        const changed = Boolean(drinkResult?.ok && drinkResult?.changed);
        const completed = Boolean(drinkResult?.ok && thirstMax > 0 && thirstCurrent >= thirstMax);

        if (changed) {
          console.log("[WATER][SERVER] drink", {
            userId: rt.userId,
            actorId: interactActorId,
            thirstCurrent,
            thirstMax,
            restored: drinkResult?.restored ?? null,
            cooldownUntilMs: drinkResult?.cooldownUntilMs ?? null,
          });
          markStatsDirty(rt.userId);
        }

        if (completed) {
          rt.interact = null;
          stopMovement(rt, { nowMs: t });
          rt.action = "idle";
          rt.waterLock = null;
        }

        if (changed || completed) {
          bumpRev(rt);
          markRuntimeDirty(rt.userId, t);
          await emitPlayerState(io, rt);
        }
      } catch (err) {
        console.error(
          `[WATER] failed to drink from river: userId=${rt.userId} actorId=${interactActorId}`,
          err
        );
      }
      return true;
    }

    const lastCollect = rt.lastActorCollectAtMs ?? 0;
    const collectCooldown = rt.collectCooldownMs ?? 1000;

    if (t >= lastCollect + collectCooldown) {
      rt.lastActorCollectAtMs = t;

      attemptCollectFromActor(rt.userId, interactActorId)
        .then((result) => {
          const activeSocket = getActiveSocket(rt.userId);
          const roomName = rt.instanceId != null ? `inst:${Number(rt.instanceId)}` : null;

            if (!result?.ok) {
              if (result?.error === "ACTOR_NOT_FOUND") {
                rt.interact = null;
                stopMovement(rt, { nowMs: t });
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
            stopMovement(rt, { nowMs: t });
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
    stopMovement(rt, { nowMs: t });
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
