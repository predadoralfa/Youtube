// server/state/persistence/flushBatch.js

const { getAllRuntimes } = require("../runtimeStore");
const {
  MIN_RUNTIME_FLUSH_GAP_MS,
  MIN_STATS_FLUSH_GAP_MS,
} = require("./config");
const { flushUserRuntime, flushUserStats } = require("./writers");

/**
 * Flush em batch com limite por tick:
 * - evita travar o event-loop
 * - prioriza quem está sujo há mais tempo
 */
async function flushDirtyBatch({ maxUsersPerTick, now }) {
  const candidates = [];

  for (const rt of getAllRuntimes()) {
    if (rt.dirtyRuntime || rt.dirtyStats) {
      candidates.push(rt);
    }
  }

  if (candidates.length === 0) return;

  // Ordena por "mais antigo sujo" (runtime primeiro, depois stats)
  candidates.sort((a, b) => {
    const aT = a.dirtyRuntime ? a.lastRuntimeDirtyAtMs : a.lastStatsDirtyAtMs;
    const bT = b.dirtyRuntime ? b.lastRuntimeDirtyAtMs : b.lastStatsDirtyAtMs;
    return (aT || 0) - (bT || 0);
  });

  let flushed = 0;

  for (const rt of candidates) {
    if (flushed >= maxUsersPerTick) break;

    // Runtime flush
    if (rt.dirtyRuntime) {
      const lastFlush = rt._lastRuntimeFlushAtMs ?? 0;
      if (now - lastFlush >= MIN_RUNTIME_FLUSH_GAP_MS) {
        const ok = await flushUserRuntime(rt.userId, now);
        if (ok) {
          rt._lastRuntimeFlushAtMs = now;
          flushed++;
        }
      }
    }

    if (flushed >= maxUsersPerTick) break;

    // Stats flush
    if (rt.dirtyStats) {
      const lastFlush = rt._lastStatsFlushAtMs ?? 0;
      if (now - lastFlush >= MIN_STATS_FLUSH_GAP_MS) {
        const ok = await flushUserStats(rt.userId, now);
        if (ok) {
          rt._lastStatsFlushAtMs = now;
          flushed++;
        }
      }
    }
  }
}

module.exports = {
  flushDirtyBatch,
};