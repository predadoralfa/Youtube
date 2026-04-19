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

    const staminaResult = applyStaminaTick(rt, t, { movedReal: false });
    const hungerResult = applyHungerTick(rt, t, { timeFactor: worldTimeFactor });
    const thirstResult = rt?.thirstSupported
      ? applyThirstTick(rt, t, { timeFactor: worldTimeFactor })
      : { changed: false };
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
  }
}

module.exports = {
  processPlayerVitalsPhase,
};
