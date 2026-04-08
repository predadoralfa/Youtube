"use strict";

const { clamp, toFiniteNumber } = require("./shared");

function resolveStaminaPersistBucket(staminaCurrent, staminaMax) {
  const max = Math.max(0, toFiniteNumber(staminaMax, 0));
  if (max <= 0) return 0;

  const ratio = clamp(toFiniteNumber(staminaCurrent, 0) / max, 0, 1);
  return Math.max(0, Math.min(4, Math.floor(ratio * 4 + 1e-9)));
}

function syncStaminaPersistMarkers(rt, bucket) {
  if (!rt) return;
  const nextBucket = Math.max(0, Math.min(4, Number(bucket)));
  rt._lastPersistedStaminaBucket = nextBucket;
  rt._lastQueuedStaminaBucket = nextBucket;
}

function shouldQueueStaminaPersist(rt, staminaCurrent, staminaMax) {
  const bucket = resolveStaminaPersistBucket(staminaCurrent, staminaMax);
  const lastQueued = Number.isFinite(Number(rt?._lastQueuedStaminaBucket))
    ? Number(rt._lastQueuedStaminaBucket)
    : Number.isFinite(Number(rt?._lastPersistedStaminaBucket))
      ? Number(rt._lastPersistedStaminaBucket)
      : bucket;

  const changed = bucket !== lastQueued;
  if (changed && rt) {
    rt._lastQueuedStaminaBucket = bucket;
  }

  return { changed, bucket, lastQueued };
}

module.exports = {
  resolveStaminaPersistBucket,
  syncStaminaPersistMarkers,
  shouldQueueStaminaPersist,
};
