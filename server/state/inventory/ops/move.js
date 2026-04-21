// server/state/inventory/ops/move.js
const { assertContainerActive, assertSlotIndex, assertQtyPositive } = require("../validate/rules");
const { INV_ERR, invError } = require("../validate/errors");
const { getGrantedContainerSlotRole } = require("../../../service/equipmentService/grantsContainer");

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

  const srcItem = invRt?.itemInstanceById?.get?.(String(src.itemInstanceId)) || null;
  const srcDef = srcItem?.itemDefId ? invRt?.itemDefsById?.get?.(String(srcItem.itemDefId)) || null : null;
  const dstItem = dst.itemInstanceId ? invRt?.itemInstanceById?.get?.(String(dst.itemInstanceId)) || null : null;
  const dstDef = dstItem?.itemDefId ? invRt?.itemDefsById?.get?.(String(dstItem.itemDefId)) || null : null;
  const originalSrcInstanceId = src.itemInstanceId;
  const ownGrantedRole =
    srcDef && srcC?.slotRole ? getGrantedContainerSlotRole(srcDef, srcC.slotRole) : null;
  if (ownGrantedRole && String(dstC?.slotRole ?? "") === String(ownGrantedRole)) {
    throw invError(
      INV_ERR.INVALID_TARGET,
      "cannot move an item into the container it grants",
      {
        itemInstanceId: src.itemInstanceId,
        sourceRole: srcC?.slotRole ?? null,
        targetRole: dstC?.slotRole ?? null,
      }
    );
  }

  const sourceQty = Math.max(0, Number(src.qty ?? 0));
  const moveQty = qty == null ? sourceQty : Math.min(sourceQty, Math.max(0, Number(qty)));
  if (!Number.isInteger(moveQty) || moveQty <= 0) {
    throw invError(INV_ERR.INVALID_QTY, "qty must be positive int", { qty: moveQty });
  }

  const sameItemDef =
    srcDef && dstDef && String(srcDef.id ?? srcDef.itemDefId ?? srcDef.item_def_id ?? "") === String(dstDef.id ?? dstDef.itemDefId ?? dstDef.item_def_id ?? "");

  if (!dst.itemInstanceId) {
    if (moveQty >= sourceQty) {
      dst.itemInstanceId = src.itemInstanceId;
      dst.qty = src.qty;
      src.itemInstanceId = null;
      src.qty = 0;
    } else {
      src.qty = sourceQty - moveQty;
      dst.itemInstanceId = "__NEW__";
      dst.qty = moveQty;
    }
  } else if (sameItemDef) {
    if (moveQty >= sourceQty) {
      dst.qty = Number(dst.qty ?? 0) + sourceQty;
      src.itemInstanceId = null;
      src.qty = 0;
    } else {
      src.qty = sourceQty - moveQty;
      dst.qty = Number(dst.qty ?? 0) + moveQty;
    }
  } else {
    // swap entre itens diferentes continua sendo o comportamento legado
    if (moveQty < sourceQty) {
      throw invError(INV_ERR.INVALID_TARGET, "cannot partially move into an occupied different item slot", {
        itemInstanceId: src.itemInstanceId,
        sourceRole: srcC?.slotRole ?? null,
        targetRole: dstC?.slotRole ?? null,
        qty: moveQty,
      });
    }

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
    needsNewInstance:
      dst.itemInstanceId === "__NEW__"
        ? {
            placeholder: "__NEW__",
            fromInstanceId: originalSrcInstanceId,
          }
        : null,
    touchedContainers: Array.from(new Set([srcC.id, dstC.id])),
    touchedSlots: [
      { containerId: srcC.id, slotIndex: fromSlot, slot: src },
      { containerId: dstC.id, slotIndex: toSlot, slot: dst },
    ],
  };
}

module.exports = { move };
