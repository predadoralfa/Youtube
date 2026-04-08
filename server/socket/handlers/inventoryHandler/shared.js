"use strict";

function safeAck(ack, payload) {
  if (typeof ack === "function") ack(payload);
}

function summarizeHeldState(heldState) {
  if (!heldState) return null;
  return {
    mode: heldState.mode ?? null,
    sourceContainerId: heldState.sourceContainerId ?? null,
    sourceSlotIndex: heldState.sourceSlotIndex ?? null,
    itemInstanceId: heldState.itemInstanceId ?? null,
    itemDefId: heldState.itemDefId ?? null,
    qty: heldState.qty ?? null,
  };
}

function summarizeIntent(intent) {
  if (!intent || typeof intent !== "object") return null;
  return {
    containerId:
      intent.containerId ?? intent?.from?.containerId ?? intent?.to?.containerId ?? null,
    slotIndex: intent.slotIndex ?? intent?.from?.slotIndex ?? intent?.to?.slotIndex ?? null,
    qty: intent.qty ?? null,
    itemInstanceId: intent.itemInstanceId ?? null,
    fromSlotCode: intent.fromSlotCode ?? null,
    toSlotCode: intent.toSlotCode ?? null,
  };
}

module.exports = {
  safeAck,
  summarizeHeldState,
  summarizeIntent,
};
