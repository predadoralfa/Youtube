"use strict";

function parseAllowedWorldEditorUserIds(rawValue) {
  return String(rawValue ?? "")
    .split(",")
    .map((entry) => Number(String(entry).trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
}

function canUserEditWorld(userIdRaw) {
  const userId = Number(userIdRaw);
  if (!Number.isInteger(userId) || userId <= 0) return false;

  const allowedUserIds = parseAllowedWorldEditorUserIds(process.env.WORLD_EDITOR_USER_IDS);
  if (allowedUserIds.length === 0) {
    return String(process.env.NODE_ENV ?? "").toLowerCase() !== "production";
  }

  return allowedUserIds.includes(userId);
}

module.exports = {
  parseAllowedWorldEditorUserIds,
  canUserEditWorld,
};
