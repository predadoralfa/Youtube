"use strict";

const { canUserEditWorld } = require("../auth/worldEditorAccess");

function requireWorldEditor(req, res, next) {
  const userId = Number(req.user?.id ?? 0);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(401).json({ message: "Usuario nao autenticado" });
  }

  if (req.user?.can_edit_world === true || canUserEditWorld(userId)) {
    return next();
  }

  return res.status(403).json({ message: "Usuario sem permissao de editor" });
}

module.exports = {
  requireWorldEditor,
};
