// server/socket/wiring/lifecycle.js

const {
  ensureRuntimeLoaded,
  setConnectionState,
} = require("../../state/runtimeStore");

const { flushUserRuntimeImmediate } = require("../../state/persistenceManager");

function nowMs() {
  return Date.now();
}

/**
 * Marca CONNECTED e faz flush opcional (crash recovery).
 */
async function onConnected(userId) {
  await ensureRuntimeLoaded(userId);

  setConnectionState(
    userId,
    {
      connectionState: "CONNECTED",
      disconnectedAtMs: null,
      offlineAllowedAtMs: null,
    },
    nowMs()
  );

  await flushUserRuntimeImmediate(userId);
}

/**
 * Instala handler de disconnect:
 * - respeita _skipDisconnectPending (sessão substituída)
 * - garante que o socket é a sessão atual (proteção race)
 * - marca DISCONNECTED_PENDING por 10s e flush imediato
 */
function installDisconnectHandler({ socket, userId, clearIfCurrentSession }) {
  socket.on("disconnect", async (reason) => {
    try {
      if (socket.data._skipDisconnectPending) return;

      const ok = clearIfCurrentSession(userId, socket);
      if (!ok) return;

      const t = nowMs();
      const offlineAt = t + 10_000;

      setConnectionState(
        userId,
        {
          connectionState: "DISCONNECTED_PENDING",
          disconnectedAtMs: t,
          offlineAllowedAtMs: offlineAt,
        },
        t
      );

      await flushUserRuntimeImmediate(userId);

      console.log(
        `[SOCKET] disconnect pending user=${userId} reason=${reason} offlineAt=${offlineAt}`
      );
    } catch (e) {
      console.error("[SOCKET] disconnect handler error:", e);
    }
  });
}

module.exports = {
  onConnected,
  installDisconnectHandler,
};