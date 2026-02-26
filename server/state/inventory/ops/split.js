// server/state/inventory/ops/split.js
const { assertContainerActive, assertSlotIndex } = require("../validate/rules");
const { INV_ERR, invError } = require("../validate/errors");

function split(invRt, intent) {
  const fromRole = intent?.from?.role;
  const fromSlot = Number(intent?.from?.slot);
  const toRole = intent?.to?.role;
  const toSlot = Number(intent?.to?.slot);
  const qty = Number(intent?.qty);

  if (!Number.isInteger(qty) || qty <= 0) throw invError(INV_ERR.INVALID_QTY);

  const srcC = invRt.containersByRole.get(fromRole) || null;
  const dstC = invRt.containersByRole.get(toRole) || null;

  assertContainerActive(srcC);
  assertContainerActive(dstC);

  assertSlotIndex(srcC, fromSlot);
  assertSlotIndex(dstC, toSlot);

  const src = srcC.slots[fromSlot];
  const dst = dstC.slots[toSlot];

  if (!src.itemInstanceId) throw invError(INV_ERR.EMPTY_SOURCE);
  if (dst.itemInstanceId) throw invError(INV_ERR.DEST_NOT_EMPTY);

  if (src.qty < 2) throw invError(INV_ERR.INVALID_QTY, "cannot split qty<2");
  if (qty >= src.qty) throw invError(INV_ERR.INVALID_QTY, "split qty must be < source qty");

  // a instância origem representa o stack
  src.qty -= qty;

  // destino recebe "nova instância" (criar no persist)
  dst.itemInstanceId = "__NEW__";
  dst.qty = qty;

  srcC.rev++;
  if (dstC.id !== srcC.id) dstC.rev++;

  return {
    needsNewInstance: {
      placeholder: "__NEW__",
      fromInstanceId: src.itemInstanceId,
    },
    touchedContainers: Array.from(new Set([srcC.id, dstC.id])),
    touchedSlots: [
      { containerId: srcC.id, slotIndex: fromSlot, slot: src },
      { containerId: dstC.id, slotIndex: toSlot, slot: dst },
    ],
  };
}

module.exports = { split };