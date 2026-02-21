// server/state/persistence/config.js

// Defaults (sobrescreva via env)
const PERSIST_TICK_MS = Number(process.env.PERSIST_TICK_MS ?? 500);
const MAX_FLUSH_PER_TICK = Number(process.env.MAX_FLUSH_PER_TICK ?? 200);

// Para evitar flush excessivo do mesmo user quando recebe muitos intents
const MIN_RUNTIME_FLUSH_GAP_MS = Number(process.env.MIN_RUNTIME_FLUSH_GAP_MS ?? 900);
const MIN_STATS_FLUSH_GAP_MS = Number(process.env.MIN_STATS_FLUSH_GAP_MS ?? 1500);

module.exports = {
  PERSIST_TICK_MS,
  MAX_FLUSH_PER_TICK,
  MIN_RUNTIME_FLUSH_GAP_MS,
  MIN_STATS_FLUSH_GAP_MS,
};