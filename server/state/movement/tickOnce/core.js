"use strict";

const { getAllRuntimes } = require("../../runtimeStore");
const { getTimeFactor } = require("../../../service/worldClockService");
const { resolveCarryWeightContext } = require("./carryWeight");
const { processAutomaticCombat } = require("./playerCombat");
const { processPlayerMovementPhase } = require("./playerMovementPhase");
const { processPlayerVitalsPhase } = require("./playerVitalsPhase");
const { processEnemyPhase } = require("./enemyPhase");
const { processBuildProgressPhase } = require("../../../service/buildProgressService");

async function tickOnce(io, nowMsValue) {
  const t = nowMsValue;
  const worldTimeFactor = await getTimeFactor();
  const allRuntimes = Array.from(getAllRuntimes());

  for (const rt of allRuntimes) {
    if (!rt) continue;
    if (rt.connectionState === "DISCONNECTED_PENDING" || rt.connectionState === "OFFLINE") {
      continue;
    }

    if (rt.combat?.state === "ENGAGED" && rt.combat?.targetKind === "ENEMY") {
      await processAutomaticCombat(io, rt, t);
    }
  }

  await processPlayerMovementPhase(
    io,
    allRuntimes,
    t,
    resolveCarryWeightContext,
    processAutomaticCombat
  );

  await processPlayerVitalsPhase(io, allRuntimes, t, worldTimeFactor);
  await processBuildProgressPhase(io, allRuntimes, t);
  await processEnemyPhase(io, allRuntimes, t, processAutomaticCombat);
}

module.exports = {
  tickOnce,
};
