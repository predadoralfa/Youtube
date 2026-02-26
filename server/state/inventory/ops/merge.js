// server/state/inventory/ops/merge.js
const { assertContainerActive, assertSlotIndex } = require("../validate/rules");
const { INV_ERR, invError } = require("../validate/errors");

function merge(invRt, intent) {
  const fromRole = intent?.from?.role;
  const fromSlot = Number(intent?.from?.slot);
  const toRole = intent?.to?.role;
  const toSlot = Number(intent?.to?.slot);

  const srcC = invRt.containersByRole.get(fromRole) || null;
  const dstC = invRt.containersByRole.get(toRole) || null;

  assertContainerActive(srcC);
  assertContainerActive(dstC);

  assertSlotIndex(srcC, fromSlot);
  assertSlotIndex(dstC, toSlot);

  const src = srcC.slots[fromSlot];
  const dst = dstC.slots[toSlot];

  if (!src.itemInstanceId) throw invError(INV_ERR.EMPTY_SOURCE);
  if (!dst.itemInstanceId) throw invError(INV_ERR.DEST_NOT_EMPTY, "merge target must be occupied");

  const srcII = invRt.itemInstanceById.get(String(src.itemInstanceId));
  const dstII = invRt.itemInstanceById.get(String(dst.itemInstanceId));
  if (!srcII || !dstII) throw invError(INV_ERR.NOT_OWNER, "instance missing from runtime");

  if (String(srcII.itemDefId) !== String(dstII.itemDefId)) throw invError(INV_ERR.NOT_SAME_ITEM);

  // merge total: destino recebe tudo, origem zera
  dst.qty += src.qty;
  src.itemInstanceId = null;
  src.qty = 0;

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

module.exports = { merge };