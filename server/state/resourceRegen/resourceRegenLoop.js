"use strict";

const { processActorResourceRegenTick } = require("../../service/actorResourceRegenService");

const RESOURCE_REGEN_TICK_MS = 60_000;

let _timer = null;
let _running = false;
let _io = null;

function startResourceRegenLoop(io = null) {
  if (_timer) return;

  _io = io;

  _timer = setInterval(async () => {
    if (_running) return;
    _running = true;

    try {
      const result = await processActorResourceRegenTick(_io, Date.now());
      if (result?.changed) {
        console.log(
          `[RESOURCE_REGEN] tick processed=${Number(result.processed ?? 0)} changed=${Boolean(result.changed)}`
        );
      }
    } catch (err) {
      console.error("[RESOURCE_REGEN] loop error:", err);
    } finally {
      _running = false;
    }
  }, RESOURCE_REGEN_TICK_MS);

  if (typeof _timer.unref === "function") _timer.unref();

  console.log(
    `[RESOURCE_REGEN] loop started interval=${RESOURCE_REGEN_TICK_MS}ms (${(RESOURCE_REGEN_TICK_MS / 1000).toFixed(0)}s)`
  );
}

function stopResourceRegenLoop() {
  if (!_timer) return;
  clearInterval(_timer);
  _timer = null;
  _running = false;
  _io = null;
  console.log("[RESOURCE_REGEN] loop stopped");
}

module.exports = {
  startResourceRegenLoop,
  stopResourceRegenLoop,
};
