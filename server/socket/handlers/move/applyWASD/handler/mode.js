"use strict";

const { clearPlayerCombat } = require("../../clearCombat");

function applyModeState(runtime, nowMs, dir, isWASDActive) {
  const wasdActiveNow = isWASDActive(runtime, nowMs);
  let modeOrActionChanged = false;
  let combatCancelled = false;

  if (wasdActiveNow) {
    if ((dir.x !== 0 || dir.z !== 0) && runtime.combat?.state === "ENGAGED") {
      combatCancelled = clearPlayerCombat(runtime);
    }

    if (runtime.moveMode === "CLICK") {
      runtime.moveTarget = null;
      runtime.moveMode = "WASD";
      modeOrActionChanged = true;
    } else if (runtime.moveMode !== "WASD") {
      runtime.moveMode = "WASD";
      modeOrActionChanged = true;
    }

    if (runtime.action !== "move") {
      runtime.action = "move";
      modeOrActionChanged = true;
    }
  } else {
    if (runtime.moveMode === "WASD") {
      runtime.moveMode = "STOP";
      modeOrActionChanged = true;
    }
    if (dir.x === 0 && dir.z === 0 && runtime.action !== "idle") {
      runtime.action = "idle";
      modeOrActionChanged = true;
    }
  }

  return {
    modeOrActionChanged,
    combatCancelled,
  };
}

module.exports = {
  applyModeState,
};
