"use strict";

const { getGrantedContainerSlotRole } = require("../../service/equipmentService/grantsContainer");

function buildItemSummaryFromInstance(inst, def) {
  if (!inst || !def) return null;

  return {
    itemInstanceId: String(inst.id),
    itemDefId: String(def.id),
    code: def.code ?? null,
    name: def.name ?? null,
    category: def.category ?? null,
    stackMax: def.stackMax ?? 1,
    durability: inst.durability ?? null,
  };
}

function buildItemSummary(equipped, invRt) {
  const inst = equipped?.itemInstance ?? null;
  const def = inst?.def ?? null;

  if (inst && def) return buildItemSummaryFromInstance(inst, def);

  const legacyContainer = invRt?.containersByRole?.get?.(equipped?.slotCode) ?? null;
  const legacySlot = legacyContainer?.slots?.find((slot) => slot?.itemInstanceId != null) ?? null;
  if (!legacySlot) return null;

  const legacyInst = invRt?.itemInstanceById?.get?.(String(legacySlot.itemInstanceId));
  const legacyDef = legacyInst ? invRt?.itemDefsById?.get?.(String(legacyInst.itemDefId)) : null;

  return buildItemSummaryFromInstance(legacyInst, legacyDef);
}

function buildLegacyItemContext(slotCode, invRt) {
  const legacyContainer = invRt?.containersByRole?.get?.(slotCode) ?? null;
  const legacySlot = legacyContainer?.slots?.find((slot) => slot?.itemInstanceId != null) ?? null;
  const legacyInst = legacySlot
    ? invRt?.itemInstanceById?.get?.(String(legacySlot.itemInstanceId)) ?? null
    : null;
  const legacyDef = legacyInst
    ? invRt?.itemDefsById?.get?.(String(legacyInst.itemDefId)) ?? null
    : null;

  return {
    legacyContainer,
    legacySlot,
    legacyInst,
    legacyDef,
    summary: buildItemSummaryFromInstance(legacyInst, legacyDef),
  };
}

function isSlotTemporarilyHeld(invRt, legacyContainer, sourceSlotIndex, equipped) {
  const heldState = invRt?.heldState ?? null;
  if (!heldState || String(heldState?.mode ?? "").toUpperCase() !== "PICK") return false;
  const equippedItemInstanceId = equipped?.itemInstanceId ?? null;
  if (legacyContainer?.id == null || sourceSlotIndex == null || equippedItemInstanceId == null) return false;

  return (
    String(heldState.sourceContainerId ?? "") === String(legacyContainer.id) &&
    Number(heldState.sourceSlotIndex) === Number(sourceSlotIndex) &&
    String(heldState.itemInstanceId ?? "") === String(equippedItemInstanceId)
  );
}

function buildEquipmentFull(eqRt, invRt = null) {
  if (!eqRt || !eqRt.userId) {
    return { ok: false, error: "EQUIPMENT_NOT_LOADED", slots: [] };
  }

  const slotDefs = eqRt.slotDefs ?? [];
  const equippedBySlotCode = eqRt.equipmentBySlotCode ?? {};

  const slots = slotDefs.map((slotDef) => {
    const equipped = equippedBySlotCode[slotDef.code] ?? null;
    const legacy = buildLegacyItemContext(slotDef.code, invRt);
    const legacyContainer = legacy.legacyContainer;
    const legacySlot = legacy.legacySlot;
    const legacyDefaultSlot = legacyContainer?.slots?.[0] ?? null;
    const sourceSlotIndex =
      legacySlot?.slotIndex != null
        ? Number(legacySlot.slotIndex)
        : legacyDefaultSlot?.slotIndex != null
          ? Number(legacyDefaultSlot.slotIndex)
          : null;
    const heldSource = equipped?.itemInstanceId != null ? equipped : legacySlot?.itemInstanceId != null
      ? { itemInstanceId: String(legacySlot.itemInstanceId) }
      : null;
    const temporarilyHeld = isSlotTemporarilyHeld(invRt, legacyContainer, sourceSlotIndex, heldSource);
    const visibleEquipped = temporarilyHeld ? null : equipped;
    const visibleSummary = temporarilyHeld
      ? null
      : visibleEquipped
        ? buildItemSummary({ ...visibleEquipped, slotCode: slotDef.code }, invRt)
        : legacy.summary;
    const grantedItemDef = visibleEquipped?.itemInstance?.def ?? legacy.legacyDef ?? null;
    const grantedRole =
      grantedItemDef && slotDef.code
        ? getGrantedContainerSlotRole(grantedItemDef, slotDef.code)
        : null;
    const grantedContainer = grantedRole ? invRt?.containersByRole?.get?.(grantedRole) ?? null : null;
    const legacyItemInstanceId = legacySlot?.itemInstanceId ?? null;
    const qty = temporarilyHeld ? 0 : legacySlot ? Number(legacySlot.qty ?? 0) : visibleEquipped ? 1 : 0;
    return {
      slotCode: slotDef.code,
      slotDefId: String(slotDef.id),
      slotKind: slotDef.slotKind ?? "WEAR",
      slotName: slotDef.name ?? slotDef.code,
      itemInstanceId: temporarilyHeld ? null : visibleEquipped?.itemInstanceId ?? legacyItemInstanceId ?? null,
      qty,
      item: visibleSummary,
      sourceContainerId: legacyContainer?.id != null ? String(legacyContainer.id) : null,
      sourceSlotIndex,
      sourceRole: slotDef.code ?? null,
      grantedContainerId: grantedContainer?.id != null ? String(grantedContainer.id) : null,
      grantedContainerSlotCount:
        grantedContainer?.def?.slotCount != null
          ? Number(grantedContainer.def.slotCount)
          : grantedContainer?.slots?.length != null
            ? Number(grantedContainer.slots.length)
            : null,
    };
  });

  return {
    ok: true,
    slots,
  };
}

module.exports = {
  buildEquipmentFull,
};
