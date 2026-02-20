// server/socket/index.js
const jwt = require("jsonwebtoken");

const {
  ensureRuntimeLoaded,
  setConnectionState,
} = require("../state/runtimeStore");

const {
  flushUserRuntimeImmediate,
} = require("../state/persistenceManager");

const { registerMoveHandler } = require("./handlers/moveHandler");

function nowMs() {
  return Date.now();
}

function registerSocket(io) {
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
    try {
      const userId = socket.data.userId;

      // 1) garante runtime em memória
      await ensureRuntimeLoaded(userId);

      // 2) marca CONNECTED e cancela qualquer pending (reconnect)
      setConnectionState(
        userId,
        {
          connectionState: "CONNECTED",
          disconnectedAtMs: null,
          offlineAllowedAtMs: null,
        },
        nowMs()
      );

      // 3) checkpoint opcional (baixo custo, mas garante crash recovery do "CONNECTED")
      // Se você achar agressivo, pode remover. Eu manteria por enquanto.
      await flushUserRuntimeImmediate(userId);

      // 4) registra handlers
      registerMoveHandler(socket);

      // 5) lifecycle: disconnect vira pending 10s
      socket.on("disconnect", async (reason) => {
        const t = nowMs();
        const offlineAt = t + 10_000;

        // marca pending (personagem fica no mundo, mas sem controle)
        setConnectionState(
          userId,
          {
            connectionState: "DISCONNECTED_PENDING",
            disconnectedAtMs: t,
            offlineAllowedAtMs: offlineAt,
          },
          t
        );

        // checkpoint imediato: anti-exploit + crash recovery
        await flushUserRuntimeImmediate(userId);

        console.log(
          `[SOCKET] disconnect pending user=${userId} reason=${reason} offlineAt=${offlineAt}`
        );
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