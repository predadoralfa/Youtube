"use strict";

function safeAck(ack, payload) {
  if (typeof ack === "function") ack(payload);
}

function logEquip(level, message, data) {
  const logger =
    level === "warn" ? console.warn : level === "error" ? console.error : console.log;
  logger(`[EQUIP] ${message}`, data || {});
}

function findOccupiedSlotIndex(container) {
  const slots = Array.isArray(container?.slots) ? container.slots : [];
  const idx = slots.findIndex((slot) => slot?.itemInstanceId != null);
  return idx >= 0 ? idx : null;
}

module.exports = {
  safeAck,
  logEquip,
  findOccupiedSlotIndex,
};
