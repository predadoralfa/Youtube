function normalizeCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
}

function getInventorySource(snapshot) {
  return snapshot?.inventory ?? snapshot ?? null;
}

function getEquipmentSource(snapshot) {
  return snapshot?.equipment ?? null;
}

function getItemDefCodeFromSlot(slot, itemInstances, itemDefs) {
  const slotItem = slot?.item ?? null;
  const itemCode = normalizeCode(slotItem?.code ?? slotItem?.itemCode ?? slotItem?.item_code ?? "");
  if (itemCode) return itemCode;

  const itemInstanceId = slot?.itemInstanceId != null ? String(slot.itemInstanceId) : null;
  if (!itemInstanceId) return null;

  const instance =
    (Array.isArray(itemInstances)
      ? itemInstances.find(
          (entry) =>
            String(entry?.id ?? entry?.itemInstanceId ?? entry?.item_instance_id ?? "") === itemInstanceId
        )
      : null) ?? null;
  const itemDefId = instance?.itemDefId ?? instance?.item_def_id ?? null;
  if (itemDefId != null && Array.isArray(itemDefs)) {
    const def =
      itemDefs.find((entry) => String(entry?.id ?? entry?.itemDefId ?? entry?.item_def_id ?? "") === String(itemDefId)) ??
      null;
    const defCode = normalizeCode(def?.code ?? def?.itemCode ?? "");
    if (defCode) return defCode;
  }

  return normalizeCode(instance?.code ?? instance?.itemCode ?? instance?.item_code ?? "");
}

function countSlotsByCode(slots, itemCode, itemInstances, itemDefs) {
  const targetCode = normalizeCode(itemCode);
  let total = 0;

  for (const slot of Array.isArray(slots) ? slots : []) {
    const qty = Math.max(0, Number(slot?.qty ?? 0));
    if (qty <= 0) continue;
    const slotCode = getItemDefCodeFromSlot(slot, itemInstances, itemDefs);
    if (slotCode !== targetCode) continue;
    total += qty;
  }

  return total;
}

function countHeldItemsByCode(snapshot, itemCode) {
  const source = getInventorySource(snapshot);
  const equipmentSource = getEquipmentSource(snapshot);
  const containers = Array.isArray(source?.containers) ? source.containers : [];
  const itemInstances = Array.isArray(source?.itemInstances)
    ? source.itemInstances
    : Array.isArray(source?.item_instances)
      ? source.item_instances
      : [];
  const itemDefs = Array.isArray(source?.itemDefs)
    ? source.itemDefs
    : Array.isArray(source?.item_defs)
      ? source.item_defs
      : [];
  const equipmentSlots = Array.isArray(equipmentSource?.slots) ? equipmentSource.slots : [];
  const equipmentItemInstances = Array.isArray(equipmentSource?.itemInstances)
    ? equipmentSource.itemInstances
    : Array.isArray(equipmentSource?.item_instances)
      ? equipmentSource.item_instances
      : itemInstances;
  const equipmentItemDefs = Array.isArray(equipmentSource?.itemDefs)
    ? equipmentSource.itemDefs
    : Array.isArray(equipmentSource?.item_defs)
      ? equipmentSource.item_defs
      : itemDefs;

  let total = 0;
  for (const container of containers) {
    const role = String(container?.slotRole ?? "").trim().toUpperCase();
    if (role !== "HAND_L" && role !== "HAND_R") continue;
    total += countSlotsByCode(container?.slots, itemCode, itemInstances, itemDefs);
  }

  for (const slot of equipmentSlots) {
    const slotCode = String(slot?.slotCode ?? "").trim().toUpperCase();
    if (slotCode !== "HAND_L" && slotCode !== "HAND_R") continue;
    const qty = Math.max(0, Number(slot?.qty ?? 0));
    if (qty <= 0) continue;

    const resolvedCode =
      getItemDefCodeFromSlot(slot, equipmentItemInstances, equipmentItemDefs) ||
      normalizeCode(slot?.item?.code ?? slot?.itemCode ?? slot?.item_code ?? "");
    if (resolvedCode !== normalizeCode(itemCode)) continue;
    total += qty;
  }

  return total;
}

function formatDurationMs(totalMs) {
  const safe = Math.max(0, Math.floor(Number(totalMs ?? 0)));
  const minutes = Math.floor(safe / 60000);
  const seconds = Math.floor((safe % 60000) / 1000);
  if (minutes <= 0) return `${seconds}s`;
  if (seconds <= 0) return `${minutes}m`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function resolvePrimitiveShelterBuildRequirements(actorState, inventorySnapshot) {
  const state = actorState ?? {};
  const defaultRequirements = Array.isArray(state.buildRequirements) && state.buildRequirements.length
    ? state.buildRequirements
    : [{ itemCode: "GRAVETO", quantity: 1 }];
  const constructionState = normalizeCode(state.constructionState ?? "PLANNED");
  const durationMs = Math.max(1000, Number.isFinite(Number(state.constructionDurationMs)) ? Number(state.constructionDurationMs) : 180000);
  const startedAtMs = Number.isFinite(Number(state.constructionStartedAtMs)) ? Number(state.constructionStartedAtMs) : 0;
  const progressMs =
    constructionState === "RUNNING" && Number.isFinite(startedAtMs) && startedAtMs > 0
      ? Math.max(0, Math.min(durationMs, Date.now() - startedAtMs))
      : Math.max(0, Number(state.constructionProgressMs ?? 0));
  const progressRatio = durationMs > 0 ? Math.max(0, Math.min(1, progressMs / durationMs)) : 0;

  const requirements = defaultRequirements.map((req) => {
    const itemCode = normalizeCode(req?.itemCode ?? req?.code ?? "GRAVETO");
    const requiredQty = Math.max(1, Number(req?.quantity ?? req?.qty ?? 1));
    const haveQty = countHeldItemsByCode(inventorySnapshot, itemCode);
    return {
      itemCode,
      requiredQty,
      haveQty,
      isMet: haveQty >= requiredQty,
    };
  });

  const canBuild = constructionState === "PLANNED" && requirements.every((req) => req.isMet);

  return {
    constructionState,
    constructionStateLabel:
      constructionState === "RUNNING" ? "Building" : constructionState === "COMPLETED" ? "Completed" : "Planning",
    durationMs,
    progressMs,
    progressRatio,
    progressLabel: `${formatDurationMs(progressMs)} / ${formatDurationMs(durationMs)}`,
    requirements,
    requirementsMet: requirements.every((req) => req.isMet),
    canBuild,
    xpReward: Math.max(0, Number(state.buildXpReward ?? 50)),
    skillCode: String(state.buildSkillCode ?? "SKILL_BUILDING").trim() || "SKILL_BUILDING",
    canCancel: constructionState === "PLANNED",
    isPlanned: constructionState === "PLANNED",
    isRunning: constructionState === "RUNNING",
    isCompleted: constructionState === "COMPLETED",
    progressText: `${Math.round(progressRatio * 100)}%`,
  };
}

export {
  countHeldItemsByCode,
  formatDurationMs,
  resolvePrimitiveShelterBuildRequirements,
};
