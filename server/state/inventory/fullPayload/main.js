"use strict";

const { buildEquipmentFull } = require("../../equipment/fullPayload");
const { getRuntime } = require("../../runtime/store");
const { hasCapability } = require("../../../service/researchService");
const { computeCarryWeight } = require("../weight");

function uniq(arr) {
  return Array.from(new Set(arr));
}

function stableSortBy(arr, pick) {
  return [...arr].sort((a, b) => {
    const av = pick(a);
    const bv = pick(b);
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  });
}

function hasRestoreHungerEffect(def) {
  const components = Array.isArray(def?.components) ? def.components : [];
  return components.some((component) => {
    const type = String(component?.componentType ?? component?.component_type ?? "").toUpperCase();
    if (type !== "EDIBLE" && type !== "CONSUMABLE") return false;
    const data = component?.dataJson ?? component?.data_json ?? null;
    const effects = Array.isArray(data?.effects) ? data.effects : [];
    return effects.some((effect) => String(effect?.type ?? "").toUpperCase() === "RESTORE_HUNGER");
  });
}

function hasMedicalEffect(def) {
  const components = Array.isArray(def?.components) ? def.components : [];
  return components.some((component) => {
    const type = String(component?.componentType ?? component?.component_type ?? "").toUpperCase();
    if (type !== "EDIBLE" && type !== "CONSUMABLE") return false;
    const data = component?.dataJson ?? component?.data_json ?? null;
    const effects = Array.isArray(data?.effects) ? data.effects : [];
      return effects.some((effect) => {
        const effectType = String(effect?.type ?? "").toUpperCase();
        return (
          effectType === "RESTORE_HP" ||
          effectType === "RESTORE_HP_PCT" ||
          effectType === "RESTORE_STAMINA" ||
          effectType === "RESTORE_IMMUNITY" ||
          effectType === "REDUCE_FEVER"
        );
      });
  });
}

function isMedicalUseUnlocked(def, research) {
  const code = String(def?.code ?? "").trim().toUpperCase();
  if (!code) return false;
  return hasCapability(research, `item.medicate:${code}`);
}

function isFoodDef(def) {
  const category = String(def?.category ?? "").toUpperCase();
  if (category !== "FOOD" && category !== "CONSUMABLE") {
    return String(def?.code ?? "").toUpperCase().startsWith("FOOD-");
  }
  return hasRestoreHungerEffect(def) || category === "FOOD";
}

function buildItemDefPayload(def, research = null) {
  return {
    id: String(def.id),
    code: def.code,
    name: def.name,
    assetKey: def.assetKey ?? def.asset_key ?? null,
    category: def.category ?? null,
    weight: def.weight ?? def.unit_weight ?? null,
    stackMax: def.stackMax ?? def.stack_max ?? 1,
    canEat: isFoodDef(def),
    canMedicate: hasMedicalEffect(def) && isMedicalUseUnlocked(def, research),
    components: Array.isArray(def.components)
      ? stableSortBy(def.components, (c) => String(c.id)).map((c) => ({
          id: String(c.id),
          componentType: c.componentType ?? c.component_type ?? null,
          dataJson: c.dataJson ?? c.data_json ?? null,
          version: c.version ?? 1,
        }))
      : [],
  };
}

function readNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function readModelValue(row, camelKey, snakeKey = camelKey) {
  return row?.[camelKey] ?? row?.[snakeKey] ?? row?.get?.(snakeKey) ?? row?.get?.(camelKey) ?? null;
}

function getCompletedResearchLevel(research, researchDefId) {
  if (researchDefId == null) return Infinity;
  const studies = Array.isArray(research?.studies) ? research.studies : [];
  const study = studies.find((item) => Number(item.researchDefId) === Number(researchDefId));
  return readNumber(study?.currentLevel, 0);
}

function isCraftUnlocked(craftDef, research) {
  const requiredResearchDefId = readModelValue(craftDef, "requiredResearchDefId", "required_research_def_id");
  if (requiredResearchDefId == null) return true;
  const requiredLevel = Math.max(
    1,
    readNumber(readModelValue(craftDef, "requiredResearchLevel", "required_research_level"), 1)
  );
  return getCompletedResearchLevel(research, requiredResearchDefId) >= requiredLevel;
}

function getCraftTimeReductionMs(craftingSkillLevel) {
  const level = Math.max(1, readNumber(craftingSkillLevel, 1));
  return Math.max(0, level - 1) * 30000;
}

function shouldIgnoreCraftTimeReduction(craftDef) {
  return String(craftDef?.code ?? "").toUpperCase() === "CRAFT_BASKET_T2";
}

function getCraftTimeForSkill(craftDef, baseCraftTimeMs, craftingSkillLevel) {
  const base = Math.max(0, readNumber(baseCraftTimeMs, 0));
  if (shouldIgnoreCraftTimeReduction(craftDef)) {
    return base;
  }
  const reduced = base - getCraftTimeReductionMs(craftingSkillLevel);
  return Math.max(1000, reduced);
}

function buildCraftPayload(craftDef, craftingSkillLevel, research = null) {
  const recipeItems = Array.isArray(craftDef?.recipeItems) ? craftDef.recipeItems : [];
  const baseCraftTimeMs = readNumber(readModelValue(craftDef, "craftTimeMs", "craft_time_ms"), 0);
  const effectiveCraftTimeMs = getCraftTimeForSkill(craftDef, baseCraftTimeMs, craftingSkillLevel);

  return {
    id: String(craftDef.id),
    code: craftDef.code,
    name: craftDef.name,
    description: craftDef.description ?? null,
    requiredSkillLevel: readNumber(
      readModelValue(craftDef, "requiredSkillLevel", "required_skill_level"),
      1
    ),
    requiredResearchDefId:
      readModelValue(craftDef, "requiredResearchDefId", "required_research_def_id") == null
        ? null
        : Number(readModelValue(craftDef, "requiredResearchDefId", "required_research_def_id")),
    requiredResearchLevel: readNumber(
      readModelValue(craftDef, "requiredResearchLevel", "required_research_level"),
      1
    ),
    outputQty: readNumber(readModelValue(craftDef, "outputQty", "output_qty"), 1),
    craftTimeMs: effectiveCraftTimeMs,
    craftTimeBaseMs: baseCraftTimeMs,
    staminaCostTotal: readNumber(
      readModelValue(craftDef, "staminaCostTotal", "stamina_cost_total"),
      0
    ),
    xpReward: readNumber(readModelValue(craftDef, "xpReward", "xp_reward"), 0),
    skillDef: craftDef.skillDef
      ? {
          id: String(craftDef.skillDef.id),
          code: craftDef.skillDef.code,
          name: craftDef.skillDef.name,
        }
      : null,
    requiredResearchDef: craftDef.requiredResearchDef
      ? {
          id: String(craftDef.requiredResearchDef.id),
          code: craftDef.requiredResearchDef.code,
          name: craftDef.requiredResearchDef.name,
        }
      : null,
    outputItemDef: craftDef.outputItemDef ? buildItemDefPayload(craftDef.outputItemDef, research) : null,
    recipeItems: stableSortBy(recipeItems, (item) =>
      `${readNumber(readModelValue(item, "sortOrder", "sort_order"), 0)}:${item.id}`
    ).map((item) => ({
      id: String(item.id),
      itemDefId: String(readModelValue(item, "itemDefId", "item_def_id")),
      quantity: readNumber(item.quantity, 1),
      role: item.role ?? "INPUT",
      sortOrder: readNumber(readModelValue(item, "sortOrder", "sort_order"), 0),
      itemDef: item.itemDef ? buildItemDefPayload(item.itemDef, research) : null,
    })),
  };
}

function buildCraftJobPayload(job, research = null) {
  const craftDef = job?.craftDef ?? null;
  const craftTimeMs = readNumber(
    readModelValue(job, "craftTimeMs", "craft_time_ms"),
    craftDef == null ? 0 : readNumber(readModelValue(craftDef, "craftTimeMs", "craft_time_ms"), 0)
  );

  return {
    id: String(job.id),
    craftDefId: String(readModelValue(job, "craftDefId", "craft_def_id")),
    craftCode: craftDef?.code ?? null,
    name: craftDef?.name ?? null,
    status: job.status ?? "PENDING",
    progressMs: readNumber(readModelValue(job, "currentProgressMs", "current_progress_ms"), 0),
    craftTimeMs,
    outputQty: craftDef == null ? 1 : readNumber(readModelValue(craftDef, "outputQty", "output_qty"), 1),
    outputItemDef: craftDef?.outputItemDef ? buildItemDefPayload(craftDef.outputItemDef, research) : null,
    startedAtMs:
      readModelValue(job, "startedAtMs", "started_at_ms") == null
        ? null
        : readNumber(readModelValue(job, "startedAtMs", "started_at_ms"), null),
    pausedAtMs:
      readModelValue(job, "pausedAtMs", "paused_at_ms") == null
        ? null
        : readNumber(readModelValue(job, "pausedAtMs", "paused_at_ms"), null),
    completedAtMs:
      readModelValue(job, "completedAtMs", "completed_at_ms") == null
        ? null
        : readNumber(readModelValue(job, "completedAtMs", "completed_at_ms"), null),
  };
}

function buildCraftSection(invRt, research) {
  const craftDefs = Array.isArray(invRt?.craftDefs) ? invRt.craftDefs : [];
  const available = craftDefs.filter((craftDef) => isCraftUnlocked(craftDef, research));
  const activeJobs = Array.isArray(invRt?.craftJobs) ? invRt.craftJobs : [];
  const craftingSkillLevel = readNumber(invRt?.skills?.SKILL_CRAFTING?.currentLevel, 1);
  const gatheringSkillLevel = readNumber(invRt?.skills?.SKILL_GATHERING?.currentLevel, 1);

  return {
    available: stableSortBy(available, (craftDef) => String(craftDef.code ?? craftDef.id)).map(
      (craftDef) => buildCraftPayload(craftDef, craftingSkillLevel, research)
    ),
    activeJobs: stableSortBy(activeJobs, (job) => String(job.id)).map((job) => buildCraftJobPayload(job, research)),
    skills: {
      crafting: invRt?.skills?.SKILL_CRAFTING ?? {
        skillCode: "SKILL_CRAFTING",
        skillName: "Crafting",
        currentLevel: craftingSkillLevel,
        currentXp: "0",
        totalXp: "0",
        requiredXp: "100",
        maxLevel: 50,
      },
      gathering: invRt?.skills?.SKILL_GATHERING ?? {
        skillCode: "SKILL_GATHERING",
        skillName: "Gathering",
        currentLevel: gatheringSkillLevel,
        currentXp: "0",
        totalXp: "0",
        requiredXp: "100",
        maxLevel: 100,
      },
    },
  };
}

function buildSkillSummaryPayload(skill, fallbackCode = null) {
  const skillCode = String(skill?.skillCode ?? skill?.code ?? fallbackCode ?? "").trim();
  const currentLevel = Math.max(
    1,
    readNumber(skill?.currentLevel ?? skill?.current_level ?? 1, 1)
  );

  return {
    skillCode,
    skillName: skill?.skillName ?? skill?.name ?? skillCode,
    currentLevel,
    currentXp: String(skill?.currentXp ?? skill?.current_xp ?? "0"),
    totalXp: String(skill?.totalXp ?? skill?.total_xp ?? "0"),
    requiredXp: String(skill?.requiredXp ?? skill?.required_xp ?? "100"),
    maxLevel: Math.max(1, readNumber(skill?.maxLevel ?? skill?.max_level ?? 1, 1)),
  };
}

function buildSkillsSection(invRt) {
  const rawSkills = invRt?.skills ?? {};
  const skillList = Array.isArray(rawSkills)
    ? rawSkills
    : Object.entries(rawSkills).map(([skillCode, skill]) => ({
        ...skill,
        skillCode: skill?.skillCode ?? skill?.code ?? skillCode,
      }));
  const preferredOrder = ["SKILL_CRAFTING", "SKILL_BUILDING", "SKILL_COOKING", "SKILL_GATHERING"];
  const orderMap = new Map(preferredOrder.map((code, index) => [code, index]));

  return stableSortBy(skillList, (skill) => {
    const code = String(skill?.skillCode ?? skill?.code ?? "").toUpperCase();
    const order = orderMap.has(code) ? orderMap.get(code) : preferredOrder.length + 1;
    return `${String(order).padStart(2, "0")}:${code}`;
  }).map((skill) => buildSkillSummaryPayload(skill));
}

function buildItemInstanceSummary(invRt, itemInstanceId) {
  if (!itemInstanceId) return null;

  const instanceMap = invRt.itemInstanceById || invRt.itemInstancesById;
  const inst = instanceMap?.get(String(itemInstanceId)) || instanceMap?.get(Number(itemInstanceId)) || null;
  if (!inst) return null;

  const def = invRt.itemDefsById?.get(String(inst.itemDefId)) || invRt.itemDefsById?.get(Number(inst.itemDefId)) || null;

  return {
    itemInstanceId: String(inst.id),
    itemDefId: String(inst.itemDefId),
    code: def?.code ?? null,
    name: def?.name ?? null,
    category: def?.category ?? null,
    stackMax: def?.stackMax ?? 1,
    durability: inst.durability ?? null,
  };
}

function isLegacyHandRole(slotRole) {
  return slotRole === "HAND_L" || slotRole === "HAND_R";
}

function buildInventoryFull(invRt, equipmentRt = null) {
  if (!invRt || !invRt.userId) {
    return { ok: false, error: "INVENTORY_NOT_LOADED" };
  }

  const containers = invRt.containers ?? [];
  const inventoryContainers = containers.filter((c) => !isLegacyHandRole(c.slotRole));
  const legacyHandContainers = containers.filter((c) => isLegacyHandRole(c.slotRole));

  const containersPayload = inventoryContainers.map((c) => ({
    id: c.id,
    slotRole: c.slotRole,
    state: c.state,
    rev: c.rev,
    def: c.def
      ? {
          id: c.def.id,
          code: c.def.code,
          name: c.def.name,
          slotCount: c.def.slotCount,
          maxWeight: c.def.maxWeight,
          allowedCategoriesMask: c.def.allowedCategoriesMask,
        }
      : null,
    slots: stableSortBy(c.slots ?? [], (s) => s.slotIndex).map((s) => ({
      slotIndex: s.slotIndex,
      itemInstanceId: s.itemInstanceId ?? null,
      qty: s.qty ?? 0,
    })),
  }));

  const referencedInstanceIds = uniq(
    [...inventoryContainers, ...legacyHandContainers]
      .flatMap((c) => c.slots ?? [])
      .map((s) => s.itemInstanceId)
      .filter((id) => id != null)
      .map((id) => String(id))
  );

  const heldState = invRt.heldState ?? null;
  if (heldState?.itemInstanceId != null) {
    referencedInstanceIds.push(String(heldState.itemInstanceId));
  }

  const normalizedReferencedInstanceIds = uniq(referencedInstanceIds);
  const instanceMap = invRt.itemInstanceById || invRt.itemInstancesById;

  const itemInstances = normalizedReferencedInstanceIds
    .map((id) => instanceMap?.get(id) || instanceMap?.get(Number(id)))
    .filter(Boolean);

  const itemInstancesPayload = stableSortBy(itemInstances, (it) => String(it.id)).map((it) => ({
    id: String(it.id),
    itemDefId: String(it.itemDefId),
    durability: it.durability ?? null,
    meta: it.meta ?? it.props ?? it.props_json ?? null,
  }));

  const referencedDefIds = uniq(
    itemInstances
      .map((it) => it.itemDefId)
      .filter((id) => id != null)
      .map((id) => String(id))
  );

  const equipmentItemDefIds = uniq(
    Object.values(equipmentRt?.equipmentBySlotCode ?? {})
      .map((equipped) => equipped?.itemDef?.id ?? equipped?.itemDefId ?? null)
      .filter((id) => id != null)
      .map((id) => String(id))
  );

  const allReferencedDefIds = uniq([...referencedDefIds, ...equipmentItemDefIds]);

  const itemDefs = allReferencedDefIds
    .map(
      (id) =>
        invRt.itemDefsById?.get(id) ||
        invRt.itemDefsById?.get(Number(id)) ||
        equipmentRt?.itemDefsById?.get?.(id) ||
        equipmentRt?.itemDefsById?.get?.(Number(id))
    )
    .filter(Boolean);

  const research = getRuntime(invRt?.userId)?.research ?? invRt?.research ?? null;

  const itemDefsPayload = stableSortBy(itemDefs, (d) => String(d.id)).map((d) => ({
    ...buildItemDefPayload(d, research),
  }));

  const heldStatePayload = heldState
    ? {
        mode: heldState.mode ?? "PICK",
        sourceContainerId: heldState.sourceContainerId != null ? String(heldState.sourceContainerId) : null,
        sourceSlotIndex:
          heldState.sourceSlotIndex != null ? Number(heldState.sourceSlotIndex) : null,
        sourceItemInstanceId:
          heldState.sourceItemInstanceId != null ? String(heldState.sourceItemInstanceId) : null,
        sourceQtyBefore:
          heldState.sourceQtyBefore != null ? Number(heldState.sourceQtyBefore) : null,
        sourceQtyAfter:
          heldState.sourceQtyAfter != null ? Number(heldState.sourceQtyAfter) : null,
        itemInstanceId:
          heldState.itemInstanceId != null ? String(heldState.itemInstanceId) : null,
        itemDefId: heldState.itemDefId != null ? String(heldState.itemDefId) : null,
        qty: heldState.qty != null ? Number(heldState.qty) : 0,
        createdAtMs: heldState.createdAtMs ?? null,
        item: buildItemInstanceSummary(invRt, heldState.itemInstanceId),
      }
    : null;

  const equipment = equipmentRt && equipmentRt.userId ? buildEquipmentFull(equipmentRt, invRt) : null;
  const equipmentSlotsForLog = Object.entries(equipmentRt?.equipmentBySlotCode ?? {}).map(
    ([slotCode, equipped]) => ({
      slotCode,
      itemInstanceId: equipped?.itemInstanceId ?? null,
      itemCode: equipped?.itemDef?.code ?? null,
      itemName: equipped?.itemDef?.name ?? null,
    })
  );
  const computedCarryWeight = computeCarryWeight(invRt, equipmentRt, research);
  const carryWeightMax = computedCarryWeight.max;
  const carryWeightCurrent = computedCarryWeight.current;
  const carryWeightRatio = carryWeightMax > 0 ? carryWeightCurrent / carryWeightMax : 0;

  invRt.carryWeightCurrent = carryWeightCurrent;
  invRt.carryWeightRatio = carryWeightRatio;
  invRt.carryWeightPercent = Math.min(100, Math.max(0, carryWeightRatio * 100));
  invRt.carryWeightMax = carryWeightMax;

  return {
    ok: true,
    containers: containersPayload,
    itemInstances: itemInstancesPayload,
    itemDefs: itemDefsPayload,
    heldState: heldStatePayload,
    carryWeight: {
      current: carryWeightCurrent,
      max: carryWeightMax,
      ratio: carryWeightRatio,
      percent:
        carryWeightMax > 0 ? Math.min(100, Math.max(0, carryWeightRatio * 100)) : 0,
      isOverCapacity: carryWeightMax > 0 ? carryWeightCurrent > carryWeightMax : false,
    },
    craft: buildCraftSection(invRt, research),
    skills: buildSkillsSection(invRt),
    equipment,
  };
}

module.exports = {
  buildInventoryFull,
};
