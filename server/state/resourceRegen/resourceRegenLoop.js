"use strict";

const { processActorResourceRegenTick } = require("../../service/actorResourceRegenService");
const db = require("../../models");

const MIN_RESOURCE_REGEN_TICK_MS = 1_000;
const MAX_RESOURCE_REGEN_TICK_MS = 60_000;
const RULE_RESOLVE_RETRY_MS = 5_000;

let _timer = null;
let _running = false;
let _io = null;
let _stopped = false;

function clampTickMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(MIN_RESOURCE_REGEN_TICK_MS, Math.min(MAX_RESOURCE_REGEN_TICK_MS, Math.floor(n)));
}

async function resolveTickMsFromDb() {
  const [rows] = await db.sequelize.query(
    `
    SELECT MIN(refill_interval_ms) AS tick_ms
    FROM ga_actor_resource_rule_def
    WHERE is_active = 1
    `
  );

  const tickMs = rows?.[0]?.tick_ms;
  return clampTickMs(tickMs);
}

function scheduleNextTick(delayMs) {
  const clampedMs = clampTickMs(delayMs) ?? RULE_RESOLVE_RETRY_MS;
  _timer = setTimeout(runLoopTick, clampedMs);
  if (typeof _timer.unref === "function") _timer.unref();
}

async function runLoopTick() {
  if (_stopped) return;

  if (_running) {
    const nextTickMs = await resolveTickMsFromDb();
    scheduleNextTick(nextTickMs);
    return;
  }

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

  let nextTickMs = null;
  try {
    nextTickMs = await resolveTickMsFromDb();
  } catch (err) {
    console.error("[RESOURCE_REGEN] failed to resolve tick from DB:", err?.message || err);
    nextTickMs = RULE_RESOLVE_RETRY_MS;
  }

  scheduleNextTick(nextTickMs);
}

async function startResourceRegenLoop(io = null) {
  if (_timer) return;

  _io = io;
  _stopped = false;

  let tickMs = null;
  try {
    tickMs = await resolveTickMsFromDb();
  } catch (err) {
    console.error("[RESOURCE_REGEN] failed to resolve startup tick from DB:", err?.message || err);
    tickMs = RULE_RESOLVE_RETRY_MS;
  }

  scheduleNextTick(tickMs);

  console.log(
    tickMs == null
      ? `[RESOURCE_REGEN] loop started with no active DB rule (retry=${RULE_RESOLVE_RETRY_MS}ms)`
      : `[RESOURCE_REGEN] loop started interval=${tickMs}ms (${(tickMs / 1000).toFixed(0)}s)`
  );
}

function stopResourceRegenLoop() {
  if (!_timer) return;
  clearTimeout(_timer);
  _timer = null;
  _running = false;
  _io = null;
  _stopped = true;
  console.log("[RESOURCE_REGEN] loop stopped");
}

module.exports = {
  startResourceRegenLoop,
  stopResourceRegenLoop,
};
