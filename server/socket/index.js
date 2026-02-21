// server/socket/index.js

const { installPersistenceHooks } = require("./wiring/persistenceHooks");
const { installAuthMiddleware } = require("./wiring/auth");

const { enforceSingleSession, clearIfCurrentSession } = require("./wiring/session");
const { onConnected, installDisconnectHandler } = require("./wiring/lifecycle");
const { registerGameHandlers } = require("./wiring/handlers");

function registerSocket(io) {
  installPersistenceHooks(io);
  installAuthMiddleware(io);

  io.on("connection", async (socket) => {
    const userId = socket.data.userId;

    try {
      // (A) sessão única
      enforceSingleSession(userId, socket);

      // (B) runtime + CONNECTED + flush
      await onConnected(userId);

      // (C) handlers
      registerGameHandlers(io, socket);

      // (D) disconnect -> pending 10s
      installDisconnectHandler({
        socket,
        userId,
        clearIfCurrentSession,
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