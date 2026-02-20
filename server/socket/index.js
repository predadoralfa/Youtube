// server/socket/index.js
const jwt = require("jsonwebtoken");

const {
  ensureRuntimeLoaded,
  getRuntime,
  setConnectionState,
} = require("../state/runtimeStore");

const {
  flushUserRuntimeImmediate,
  onEntityDespawn,
} = require("../state/persistenceManager");

const { addUserToInstance } = require("../state/presenceIndex");

const { registerMoveHandler } = require("./handlers/moveHandler");
const { registerWorldHandler } = require("./handlers/worldHandler");

// userId -> socket.id (sessão autoritativa única)
const activeSocketByUserId = new Map();

let _despawnHookInstalled = false;

function nowMs() {
  return Date.now();
}

function installPersistenceHooks(io) {
  if (_despawnHookInstalled) return;
  _despawnHookInstalled = true;

  // OFFLINE definitivo -> despawn autoritativo
  onEntityDespawn((evt) => {
    try {
      const entityId = String(evt.entityId);
      const instanceId = String(evt.instanceId);
      const rev = Number(evt.rev ?? 0);

      // dedup de rooms alvo
      const targets = new Set();
      targets.add(`inst:${instanceId}`);

      if (Array.isArray(evt.interestRooms)) {
        for (const r of evt.interestRooms) targets.add(String(r));
      }

      const payload = { entityId, rev };

      for (const room of targets) {
        io.to(room).emit("entity:despawn", payload);
      }

      // opcional: log baixo ruído
      // console.log(`[SOCKET] broadcast despawn entity=${entityId} instance=${instanceId}`);
    } catch (e) {
      console.error("[SOCKET] despawn hook error:", e);
    }
  });
}

function registerSocket(io) {
  installPersistenceHooks(io);

  io.use((socket, next) => {
    try {
      const raw = socket.handshake?.auth?.token;

      if (!raw) {
        return next(new Error("UNAUTHORIZED"));
      }

      // aceita tanto "<token>" quanto "Bearer <token>"
      const token = String(raw).startsWith("Bearer ")
        ? String(raw).slice("Bearer ".length)
        : String(raw);

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "chave_mestra_extrema"
      );

      // mesmo contrato do requireAuth: { id, display_name }
      if (!decoded?.id) {
        return next(new Error("UNAUTHORIZED"));
      }

      socket.data.userId = decoded.id;
      socket.data.displayName = decoded.display_name ?? null;

      return next();
    } catch (err) {
      return next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.data.userId;

    try {
      // =========================
      // (A) Sessão única por userId
      // =========================
      const prevSocketId = activeSocketByUserId.get(String(userId));
      if (prevSocketId && prevSocketId !== socket.id) {
        const prev = io.sockets.sockets.get(prevSocketId);
        if (prev) {
          // marca para não disparar DISCONNECTED_PENDING no socket antigo
          prev.data._skipDisconnectPending = true;

          // avisa cliente antigo (se quiser mostrar UI)
          prev.emit("session:replaced", {
            by: socket.id,
            userId,
          });

          // derruba sessão antiga
          prev.disconnect(true);
        }
      }

      // define este como a sessão atual
      activeSocketByUserId.set(String(userId), socket.id);

      // =========================
      // (B) Runtime + state CONNECTED
      // =========================
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

      // checkpoint opcional (crash recovery do "CONNECTED")
      await flushUserRuntimeImmediate(userId);

      // =========================
      // (C) Handlers existentes
      // =========================
      registerMoveHandler(socket);

      registerWorldHandler(io, socket);

      // =========================
      // (E) lifecycle: disconnect vira pending 10s
      // =========================
      socket.on("disconnect", async (reason) => {
        try {
          // socket substituído: não mexe em connectionState
          if (socket.data._skipDisconnectPending) return;

          // se não for a sessão atual, ignora (evita race/overlap)
          const currentId = activeSocketByUserId.get(String(userId));
          if (currentId !== socket.id) return;

          // limpa sessão atual
          activeSocketByUserId.delete(String(userId));

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

      socket.emit("socket:ready", { ok: true });
      console.log(`[SOCKET] connected user=${userId}`);
    } catch (e) {
      console.error("[SOCKET] connection error:", e);
      socket.disconnect(true);
    }
  });
}

module.exports = { registerSocket };
