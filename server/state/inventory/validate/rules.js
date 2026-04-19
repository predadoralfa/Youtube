// server/state/inventory/validate/rules.js
const { INV_ERR, invError } = require("./errors");

function assertContainerActive(container) {
  if (!container) throw invError(INV_ERR.CONTAINER_NOT_FOUND);
  if (container.state && container.state !== "ACTIVE") {
    throw invError(INV_ERR.CONTAINER_DISABLED);
  }
}

function assertContainerActiveOrRole(container, role) {
  if (!container && !role) throw invError(INV_ERR.CONTAINER_NOT_FOUND);
  if (container && container.state && container.state !== "ACTIVE") {
    throw invError(INV_ERR.CONTAINER_DISABLED);
  }
}

function assertSlotIndex(container, slotIndex) {
  const max = container.slotCount;
  if (slotIndex < 0 || slotIndex >= max) {
    throw invError(INV_ERR.SLOT_OOB, "slot out of bounds", { slotIndex, max });
  }
}

function assertQtyPositive(qty) {
  if (qty == null) return;
  if (!Number.isInteger(qty) || qty <= 0) {
    throw invError(INV_ERR.INVALID_QTY, "qty must be positive int", { qty });
  }
}

module.exports = {
  assertContainerActive,
  assertContainerActiveOrRole,
  assertSlotIndex,
  assertQtyPositive,
};
