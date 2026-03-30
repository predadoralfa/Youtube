// server/state/inventory/ops/move.js
const { assertContainerActive, assertSlotIndex, assertQtyPositive } = require("../validate/rules");
const { INV_ERR, invError } = require("../validate/errors");

function getContainerByRole(invRt, role) {
  return invRt.containersByRole.get(role) || null;
}

function move(invRt, intent) {
  if (invRt?.heldState) {
    throw invError(INV_ERR.HELD_STATE_ACTIVE, "cannot move while holding an item");
  }

  const fromRole = intent?.from?.role;
  const fromSlot = Number(intent?.from?.slot);
  const toRole = intent?.to?.role;
  const toSlot = Number(intent?.to?.slot);

  const qty = intent?.qty == null ? null : Number(intent.qty);
  assertQtyPositive(qty);

  const srcC = getContainerByRole(invRt, fromRole);
  const dstC = getContainerByRole(invRt, toRole);

  assertContainerActive(srcC);
  assertContainerActive(dstC);

  assertSlotIndex(srcC, fromSlot);
  assertSlotIndex(dstC, toSlot);

  const src = srcC.slots[fromSlot];
  const dst = dstC.slots[toSlot];

  if (!src.itemInstanceId) throw invError(INV_ERR.EMPTY_SOURCE);

  // move completo (MVP)
  if (!dst.itemInstanceId) {
    dst.itemInstanceId = src.itemInstanceId;
    dst.qty = src.qty;

    src.itemInstanceId = null;
    src.qty = 0;
  } else {
    // swap
    const tmpId = dst.itemInstanceId;
    const tmpQty = dst.qty;

    dst.itemInstanceId = src.itemInstanceId;
    dst.qty = src.qty;

    src.itemInstanceId = tmpId;
    src.qty = tmpQty;
  }

  // bump rev
  srcC.rev++;
  if (dstC.id !== srcC.id) dstC.rev++;

  return {
    touchedContainers: Array.from(new Set([srcC.id, dstC.id])),
    touchedSlots: [
      { containerId: srcC.id, slotIndex: fromSlot, slot: src },
      { containerId: dstC.id, slotIndex: toSlot, slot: dst },
    ],
  };
}

module.exports = { move };
