// socket/index.js
const jwt = require("jsonwebtoken");
const { ensureRuntimeLoaded } = require("../state/runtimeStore");
const { registerMoveHandler } = require("./handlers/moveHandler");

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

      // mesmo fallback do requireAuth
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
  });console.log("[SOCKET] JWT_SECRET exists?", !!process.env.JWT_SECRET);

  io.on("connection", async (socket) => {
    try {
      const userId = socket.data.userId;

      await ensureRuntimeLoaded(userId);
      registerMoveHandler(socket);
      


      socket.emit("socket:ready", { ok: true });
      console.log(`[SOCKET] connected user=${userId}`);
    } catch (e) {
      console.error("[SOCKET] connection error:", e);
      socket.disconnect(true);
    }
  });
}

module.exports = { registerSocket };
