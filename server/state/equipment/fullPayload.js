"use strict";

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

function buildEquipmentFull(eqRt, invRt = null) {
  if (!eqRt || !eqRt.userId) {
    return { ok: false, error: "EQUIPMENT_NOT_LOADED", slots: [] };
  }

  const slotDefs = eqRt.slotDefs ?? [];
  const equippedBySlotCode = eqRt.equipmentBySlotCode ?? {};

  const slots = slotDefs.map((slotDef) => {
    const equipped = equippedBySlotCode[slotDef.code] ?? null;
    const legacyContainer = invRt?.containersByRole?.get?.(slotDef.code) ?? null;
    const legacySlot = legacyContainer?.slots?.find((slot) => slot?.itemInstanceId != null) ?? null;
    const legacyDefaultSlot = legacyContainer?.slots?.[0] ?? null;
    const legacyItemInstanceId = legacySlot?.itemInstanceId ?? null;
    const qty = legacySlot ? Number(legacySlot.qty ?? 0) : equipped ? 1 : 0;
    const summary = buildItemSummary({ ...equipped, slotCode: slotDef.code }, invRt);
    return {
      slotCode: slotDef.code,
      slotDefId: String(slotDef.id),
      slotKind: slotDef.slotKind ?? "WEAR",
      slotName: slotDef.name ?? slotDef.code,
      itemInstanceId: equipped?.itemInstanceId ?? legacyItemInstanceId ?? null,
      qty,
      item: summary,
      sourceContainerId: legacyContainer?.id != null ? String(legacyContainer.id) : null,
      sourceSlotIndex:
        legacySlot?.slotIndex != null
          ? Number(legacySlot.slotIndex)
          : legacyDefaultSlot?.slotIndex != null
            ? Number(legacyDefaultSlot.slotIndex)
            : null,
      sourceRole: slotDef.code ?? null,
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
