// server/state/persistence/disconnects.js

const {
  getAllRuntimes,
  setConnectionState,
  hasRuntime,
  deleteRuntime,
} = require("../runtimeStore");

const { getUserPresenceState, removeUserFromInstance } = require("../presenceIndex");
const { bumpRev } = require("./rev");
const { flushUserRuntime } = require("./writers");
const { persistenceEvents } = require("./events");

/**
 * Regras do plano:
 * - DISCONNECTED_PENDING fica no mundo por 10s
 * - após offlineAllowedAtMs: vira OFFLINE e pode ser removido do mundo
 *
 * ETAPA 6:
 * - Ao virar OFFLINE real, emitir entity:despawn (via evento interno)
 * - Remover da presença (em memória) para baseline futuro não incluir
 *
 * Importante:
 * - Ao virar OFFLINE, fazemos flush imediato e eviction do runtime do Map
 *   para impedir "cache fantasma" sobrescrevendo o banco.
 */
async function tickDisconnects(now) {
  for (const rt of getAllRuntimes()) {
    if (rt.connectionState !== "DISCONNECTED_PENDING") continue;
    if (rt.offlineAllowedAtMs == null) continue;

    if (now >= rt.offlineAllowedAtMs) {
      const userId = rt.userId;

      // snapshot de presença ANTES de remover (para broadcast por rooms no consumidor)
      const presence = getUserPresenceState(userId);

      // rev monotônico: "despawn" é uma revisão do estado replicável
      bumpRev(rt);

      // Finaliza logout lógico (marca dirtyRuntime)
      setConnectionState(
        userId,
        {
          connectionState: "OFFLINE",
          disconnectedAtMs: rt.disconnectedAtMs ?? now,
          offlineAllowedAtMs: rt.offlineAllowedAtMs,
        },
        now
      );

      // DEBUG: runtime ainda está em memória?
      console.log(
        `[PERSIST] OFFLINE reached user=${userId} hasRuntime(beforeFlush)=${hasRuntime(
          userId
        )} dirtyRuntime=${!!rt.dirtyRuntime}`
      );

      // Flush final do OFFLINE imediatamente (não depende do batch)
      await flushUserRuntime(userId, now);

      // Remove da presença em memória (OFFLINE real sai do mundo)
      removeUserFromInstance(userId);

      // Emite evento interno: o layer de socket decide como/para quem broadcastar
      // payload inclui rooms de interest "anteriores" para despawn consistente.
      persistenceEvents.emit("entity:despawn", {
        entityId: String(userId),
        instanceId: presence?.instanceId ?? String(rt.instanceId),
        interestRooms: presence?.interestRooms
          ? Array.from(presence.interestRooms)
          : [],
        rev: Number(rt.rev ?? 0),
        atMs: now,
      });

      // Eviction: remove runtime do cache quente
      const removed = deleteRuntime(userId);

      console.log(
        `[PERSIST] logout finalized user=${userId} state=OFFLINE evicted=${removed} hasRuntime(afterEvict)=${hasRuntime(
          userId
        )}`
      );
    }
  }
}

module.exports = {
  tickDisconnects,
};