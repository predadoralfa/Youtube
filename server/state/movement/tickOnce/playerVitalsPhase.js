"use strict";

const { bumpRev, toDelta } = require("../entity");
const { markRuntimeDirty, markStatsDirty } = require("../../runtimeStore");
const { getActiveSocket } = require("../../../socket/sessionIndex");
const { computeChunkFromPos } = require("../../presenceIndex");
const {
  applyStaminaTick,
  applyHungerTick,
  applyThirstTick,
  shouldQueueStaminaPersist,
} = require("../stamina");
const {
  readRuntimeImmunityCurrent,
  readRuntimeImmunityMax,
} = require("../stamina/runtimeVitals");
const {
  applyImmunityTick,
  applySleepTick,
  resolveClimateStressFactor,
} = require("../status");
const { applyFeverTick } = require("../../conditions/fever");
const { emitDeltaToInterest } = require("../emit");
const { ensureInventoryLoaded } = require("../../inventory/loader");
const { ensureEquipmentLoaded } = require("../../equipment/loader");
const { buildInventoryFull } = require("../../inventory/fullPayload");
const { processAutoFoodTick, buildAutoFoodPayload } = require("../../../service/autoFoodService");
const { processResearchTick, buildResearchPayload } = require("../../../service/researchService");

async function processPlayerVitalsPhase(io, allRuntimes, t, worldTimeFactor) {
  for (const rt of allRuntimes) {
    if (!rt) continue;
    if (rt.connectionState === "DISCONNECTED_PENDING" || rt.connectionState === "OFFLINE") continue;

    const sleepDrainFactor = rt?.sleepLock?.active === true ? 0.25 : 1;
    const hungerResult = applyHungerTick(rt, t, { timeFactor: worldTimeFactor * sleepDrainFactor });
    const thirstResult = rt?.thirstSupported
      ? applyThirstTick(rt, t, { timeFactor: worldTimeFactor * sleepDrainFactor })
      : { changed: false };
    const climateStressFactor = resolveClimateStressFactor(rt.instanceId);
    const hungerRatio =
      (rt?.hungerCurrent ?? rt?.stats?.hungerCurrent ?? 100) /
      Math.max(1, rt?.hungerMax ?? rt?.stats?.hungerMax ?? 100);
    const thirstRatio = rt?.thirstSupported
      ? (rt?.thirstCurrent ?? rt?.stats?.thirstCurrent ?? 100) / 
        Math.max(1, rt?.thirstMax ?? rt?.stats?.thirstMax ?? 100)
      : 1;
    const hpRatio =
      (rt?.hpCurrent ?? rt?.stats?.hpCurrent ?? 100) / Math.max(1, rt?.hpMax ?? rt?.stats?.hpMax ?? 100);
    const immunityBeforeTick = readRuntimeImmunityCurrent(rt);
    const immunityMaxBeforeTick = readRuntimeImmunityMax(rt);
    const immunityResult = applyImmunityTick(rt, t, {
      timeFactor: worldTimeFactor,
      climateStressFactor,
      hungerRatio,
      thirstRatio,
      hpRatio,
      sleeping: rt?.sleepLock?.active === true,
    });
    const feverResult = applyFeverTick(rt, t, {
      timeFactor: worldTimeFactor,
      immunityCurrent: immunityBeforeTick,
      immunityMax: immunityMaxBeforeTick,
      sleeping: rt?.sleepLock?.active === true,
    });
    const sleepResult = applySleepTick(rt, t, {
      timeFactor: worldTimeFactor,
      sleeping: rt?.sleepLock?.active === true,
    });
    const staminaResult = applyStaminaTick(rt, t, {
      movedReal: false,
      regenMultiplier: 1,
      hpRegenMultiplier: 1,
    });
    const autoFoodResult = await processAutoFoodTick(rt, t);
    const researchResult = await processResearchTick(rt, t, 50);

    const staminaState = shouldQueueStaminaPersist(
      rt,
      rt?.staminaCurrent ?? rt?.stats?.staminaCurrent ?? rt?.combat?.staminaCurrent,
      rt?.staminaMax ?? rt?.stats?.staminaMax ?? rt?.combat?.staminaMax
    );

    if (
      !staminaResult.changed &&
      !hungerResult.changed &&
      !thirstResult.changed &&
        !immunityResult.changed &&
        !feverResult.changed &&
        !sleepResult.changed &&
        !autoFoodResult.changed &&
        !researchResult.changed
    ) {
      continue;
    }

    markStatsDirty(rt.userId, t);
    bumpRev(rt);
    markRuntimeDirty(rt.userId, t);

    const socket = getActiveSocket(rt.userId);
    const delta = toDelta(rt);
    emitDeltaToInterest(io, socket, rt.userId, delta);

    if (socket) {
      socket.emit("move:state", {
        entityId: String(rt.userId),
        pos: rt.pos,
        yaw: rt.yaw,
        rev: rt.rev ?? 0,
        chunk: rt.chunk ?? computeChunkFromPos(rt.pos),
        vitals: delta.vitals,
        status: delta.status,
      });

      if (autoFoodResult.inventoryChanged) {
        const invRt = await ensureInventoryLoaded(rt.userId);
        const eqRt = await ensureEquipmentLoaded(rt.userId);
        const full = buildInventoryFull(invRt, eqRt);
        full.macro = {
          autoFood: buildAutoFoodPayload(rt),
        };
        socket.emit("inv:full", full);
      }

      if (researchResult.changed) {
        socket.emit("research:full", buildResearchPayload(rt));
      }
    }

    if (staminaState.changed) {
      markStatsDirty(rt.userId, t);
    }

    if (immunityResult.changed) {
      markStatsDirty(rt.userId, t);
    }

    if (feverResult.changed) {
      markStatsDirty(rt.userId, t);
    }

    if (sleepResult.changed) {
      markStatsDirty(rt.userId, t);
    }
  }
}

module.exports = {
  processPlayerVitalsPhase,
};
