// server/state/persistenceManager.js
const db = require("../models");
const {
  getAllRuntimes,
  getRuntime,
  setConnectionState,
} = require("./runtimeStore");

// Defaults (sobrescreva via env)
const PERSIST_TICK_MS = Number(process.env.PERSIST_TICK_MS ?? 500);
const MAX_FLUSH_PER_TICK = Number(process.env.MAX_FLUSH_PER_TICK ?? 200);

// Para evitar flush excessivo do mesmo user quando recebe muitos intents
const MIN_RUNTIME_FLUSH_GAP_MS = Number(process.env.MIN_RUNTIME_FLUSH_GAP_MS ?? 900);
const MIN_STATS_FLUSH_GAP_MS = Number(process.env.MIN_STATS_FLUSH_GAP_MS ?? 1500);

let _timer = null;

function nowMs() {
  return Date.now();
}

function startPersistenceLoop() {
  if (_timer) return;

  _timer = setInterval(async () => {
    const t0 = nowMs();
    try {
      tickDisconnects(t0);
      await flushDirtyBatch({ maxUsersPerTick: MAX_FLUSH_PER_TICK, now: t0 });
    } catch (err) {
      console.error("[PERSIST] loop error:", err);
    }
  }, PERSIST_TICK_MS);

  console.log(
    `[PERSIST] loop started tick=${PERSIST_TICK_MS}ms maxFlushPerTick=${MAX_FLUSH_PER_TICK}`
  );
}

function stopPersistenceLoop() {
  if (!_timer) return;
  clearInterval(_timer);
  _timer = null;
  console.log("[PERSIST] loop stopped");
}

/**
 * Regras do plano:
 * - DISCONNECTED_PENDING fica no mundo por 10s
 * - após offlineAllowedAtMs: vira OFFLINE e pode ser removido do mundo (futuro)
 */
function tickDisconnects(now) {
  for (const rt of getAllRuntimes()) {
    if (rt.connectionState !== "DISCONNECTED_PENDING") continue;
    if (rt.offlineAllowedAtMs == null) continue;

    if (now >= rt.offlineAllowedAtMs) {
      // Finaliza logout lógico (não despawnamos aqui; só marcamos estado)
      setConnectionState(rt.userId, {
        connectionState: "OFFLINE",
        disconnectedAtMs: rt.disconnectedAtMs ?? now,
        offlineAllowedAtMs: rt.offlineAllowedAtMs,
      }, now);

      // Aqui o runtime foi marcado dirtyRuntime pelo setConnectionState.
      // O flush vai acontecer pelo batch.
      console.log(
        `[PERSIST] logout finalized user=${rt.userId} state=OFFLINE`
      );
    }
  }
}

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

/**
 * Flush do runtime (pos/yaw/instance + connection fields)
 * - UPDATE por PK user_id
 */
async function flushUserRuntime(userId, now) {
  const rt = getRuntime(userId);
  if (!rt) return false;

  // Só escreve se ainda está dirty
  if (!rt.dirtyRuntime) return false;

  try {
    const payload = {
      instance_id: rt.instanceId,
      pos_x: rt.pos?.x ?? 0,
      pos_y: rt.pos?.y ?? 0,
      pos_z: rt.pos?.z ?? 0,
      yaw: rt.yaw ?? 0,

      connection_state: rt.connectionState ?? "OFFLINE",
      disconnected_at: rt.disconnectedAtMs ?? null,
      offline_allowed_at: rt.offlineAllowedAtMs ?? null,
    };

    await db.GaUserRuntime.update(payload, {
      where: { user_id: rt.userId },
    });

    rt.dirtyRuntime = false;

    // log só em eventos relevantes
    if (rt.connectionState !== "CONNECTED") {
      console.log(
        `[PERSIST] flushed runtime user=${rt.userId} state=${rt.connectionState}`
      );
    }

    return true;
  } catch (err) {
    console.error(`[PERSIST] flushUserRuntime failed user=${rt?.userId}`, err);
    return false;
  }
}

/**
 * Flush dos stats.
 * Hoje: só move_speed existe.
 * Amanhã: você pode expandir para payload parcial (dirty fields).
 */
async function flushUserStats(userId, now) {
  const rt = getRuntime(userId);
  if (!rt) return false;
  if (!rt.dirtyStats) return false;

  try {
    // Neste momento, stats “autoritativos” não estão sendo editados no runtime,
    // exceto refreshRuntimeStats que atualiza speed cacheado.
    // Se no futuro você mantiver mais stats em memória, expanda aqui.

    // ⚠️ Hoje vamos persistir apenas move_speed se você quiser.
    // Como speed vem do DB e é cache, normalmente não precisa write-back.
    // Então por padrão: apenas limpa dirtyStats para não ficar batendo.
    // Se você começar a mutar stats em runtime, aí sim faça UPDATE.

    // Exemplo (se decidir persistir):
    // await db.GaUserStats.update(
    //   { move_speed: rt.speed },
    //   { where: { user_id: rt.userId } }
    // );

    rt.dirtyStats = false;
    return true;
  } catch (err) {
    console.error(`[PERSIST] flushUserStats failed user=${rt?.userId}`, err);
    return false;
  }
}

/**
 * Checkpoint imediato para usar no disconnect.
 * Regra do plano: no disconnect, flush runtime na hora.
 */
async function flushUserRuntimeImmediate(userId) {
  return flushUserRuntime(userId, nowMs());
}

module.exports = {
  startPersistenceLoop,
  stopPersistenceLoop,

  tickDisconnects,
  flushDirtyBatch,

  flushUserRuntime,
  flushUserStats,
  flushUserRuntimeImmediate,
};