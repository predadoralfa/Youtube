// server/socket/wiring/auth.js
const jwt = require("jsonwebtoken");
const { canUserEditWorld } = require("../../auth/worldEditorAccess");

function installAuthMiddleware(io) {
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
      socket.data.canEditWorld =
        decoded.can_edit_world === true || canUserEditWorld(decoded.id);

      return next();
    } catch (_err) {
      return next(new Error("UNAUTHORIZED"));
    }
  });
}

module.exports = {
  installAuthMiddleware,
};
