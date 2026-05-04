const jwt = require("jsonwebtoken");
const { canUserEditWorld } = require("../auth/worldEditorAccess");

function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token ausente" });
  }

  const token = header.slice("Bearer ".length);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "chave_mestra_extrema");
    // seu token carrega { id, display_name }
    req.user = {
      id: decoded.id,
      display_name: decoded.display_name ?? null,
      can_edit_world:
        decoded.can_edit_world === true || canUserEditWorld(decoded.id),
    };
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Token inválido ou expirado" });
  }
}

module.exports = { requireAuth };
