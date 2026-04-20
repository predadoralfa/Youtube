"use strict";

const db = require("../models");
const { ensureInventoryLoaded } = require("../state/inventory/loader");
const { ensureEquipmentLoaded } = require("../state/equipment/loader");
const { buildInventoryFull } = require("../state/inventory/fullPayload");
const { withInventoryLock } = require("../state/inventory/store");
const { clearEquipment } = require("../state/equipment/store");
const { markRuntimeDirty, markStatsDirty } = require("../state/runtime/dirty");
const { getRuntime } = require("../state/runtime/store");
const { getTimeFactor } = require("./worldClockService");
const { hasCapability } = require("./researchService");
const {
  readRuntimeHpCurrent,
  readRuntimeHpMax,
  readRuntimeStaminaCurrent,
  readRuntimeStaminaMax,
  readRuntimeImmunityCurrent,
  readRuntimeImmunityMax,
  readRuntimeDiseaseLevel,
  readRuntimeDiseaseSeverity,
  syncRuntimeHp,
  syncRuntimeStamina,
  syncRuntimeImmunity,
  syncRuntimeDisease,
} = require("../state/movement/stamina/runtimeVitals");
const { normalizeItemDefRow, normalizeItemDefComponentRow } = require("../state/inventory/loader/normalize");

const HERBS_ITEM_CODE = "HERBS";
const HERBS_HEAL_PERCENT = 5;
const HERBS_COOLDOWN_WORLD_HOURS = 1;

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseMaybeJsonObject(value) {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function findSlotByItemInstance(invRt, itemInstanceId) {
  const target = String(itemInstanceId ?? "");
  if (!target) return null;

  for (const container of invRt?.containers ?? []) {
    for (const slot of container?.slots ?? []) {
      if (String(slot?.itemInstanceId ?? "") === target && Number(slot?.qty ?? 0) > 0) {
        return { container, slot };
      }
    }
  }

  return null;
}

function findMedicalLocation(invRt, equipmentRt, itemInstanceId) {
  const inventorySlotRef = findSlotByItemInstance(invRt, itemInstanceId);
  if (inventorySlotRef) {
    return {
      kind: "INVENTORY",
      ...inventorySlotRef,
    };
  }

  const target = String(itemInstanceId ?? "");
  if (!target) return null;

  for (const [slotCode, equipped] of Object.entries(equipmentRt?.equipmentBySlotCode ?? {})) {
    if (String(equipped?.itemInstanceId ?? "") !== target) continue;
    return {
      kind: "EQUIPMENT",
      slotCode,
      equipment: equipped,
    };
  }

  return null;
}

function getMedicalItemInstance(invRt, equipmentRt, itemInstanceId) {
  const target = String(itemInstanceId ?? "");
  if (!target) return null;

  return (
    invRt?.itemInstanceById?.get?.(target) ??
    invRt?.itemInstancesById?.get?.(target) ??
    equipmentRt?.itemInstancesById?.get?.(target) ??
    null
  );
}

function findMedicalComponent(itemDef) {
  const components = Array.isArray(itemDef?.components) ? itemDef.components : [];
  return (
    components.find((component) => {
      const type = String(component?.componentType ?? component?.component_type ?? "").toUpperCase();
      return type === "EDIBLE" || type === "CONSUMABLE";
    }) ?? null
  );
}

function ensureMedicalState(rt) {
  if (!rt.status) rt.status = {};
  if (!rt.status.medical) rt.status.medical = { cooldowns: {} };
  if (!rt.status.medical.cooldowns) rt.status.medical.cooldowns = {};
  return rt.status.medical;
}

function resolveMedicalCooldownMs(itemCode, medicalSpec, timeFactor = 1) {
  const baseCooldownMs = Math.max(0, toFiniteNumber(medicalSpec?.cooldownMs, 0));
  if (baseCooldownMs > 0) {
    return baseCooldownMs;
  }

  if (String(itemCode ?? "").toUpperCase() === HERBS_ITEM_CODE) {
    const factor = Math.max(1, toFiniteNumber(timeFactor, 1));
    return Math.round((HERBS_COOLDOWN_WORLD_HOURS * 60 * 60 * 1000) / factor);
  }

  return 0;
}

function isMedicalLikeCategory(itemDef) {
  const category = String(itemDef?.category ?? "").toUpperCase();
  return category === "CONSUMABLE" || category === "MISC" || category === "MEDICINE";
}

async function ensureItemDefHydrated(invRt, equipmentRt, itemDefId) {
  const key = String(itemDefId ?? "");
  if (!key) return null;

  const invMap = invRt?.itemDefsById ?? null;
  const eqMap = equipmentRt?.itemDefsById ?? null;
  let itemDef = invMap?.get?.(key) ?? eqMap?.get?.(key) ?? null;
  const hasComponents = Array.isArray(itemDef?.components) && itemDef.components.length > 0;

  if (itemDef && hasComponents) return itemDef;

  const itemDefRow = await db.GaItemDef.findByPk(Number(key));
  if (!itemDefRow) return itemDef;

  const hydratedDef = normalizeItemDefRow(itemDefRow);
  const componentRows = await db.GaItemDefComponent.findAll({
    where: { item_def_id: Number(key) },
    order: [["id", "ASC"]],
  });
  hydratedDef.components = componentRows.map(normalizeItemDefComponentRow);

  invMap?.set?.(key, hydratedDef);
  eqMap?.set?.(key, hydratedDef);
  return hydratedDef;
}

async function getMedicalSpec(invRt, equipmentRt, itemInstanceId) {
  const itemInstance = getMedicalItemInstance(invRt, equipmentRt, itemInstanceId);
  if (!itemInstance) return null;

  let itemDef =
    invRt?.itemDefsById?.get?.(String(itemInstance.itemDefId)) ??
    equipmentRt?.itemDefsById?.get?.(String(itemInstance.itemDefId)) ??
    null;
  itemDef = itemDef ?? (await ensureItemDefHydrated(invRt, equipmentRt, itemInstance.itemDefId));
  if (itemDef && (!Array.isArray(itemDef.components) || itemDef.components.length === 0)) {
    itemDef = await ensureItemDefHydrated(invRt, equipmentRt, itemInstance.itemDefId);
  }

  if (!itemDef || !isMedicalLikeCategory(itemDef)) return null;

  const component = findMedicalComponent(itemDef);
  const data = component?.dataJson ?? component?.data_json ?? null;
  const effects = Array.isArray(data?.effects) ? data.effects : [];
  const medicalEffects = effects.filter((effect) => {
    const type = String(effect?.type ?? "").toUpperCase();
    return (
      type === "RESTORE_HUNGER" ||
      type === "RESTORE_HP" ||
      type === "RESTORE_STAMINA" ||
      type === "RESTORE_IMMUNITY" ||
      type === "REDUCE_FEVER" ||
      type === "RESTORE_HP_PCT"
    );
  });

  const itemCode = String(itemDef?.code ?? "").trim().toUpperCase();
  if (medicalEffects.length === 0 && itemCode !== HERBS_ITEM_CODE) return null;

  const normalizedEffects =
    itemCode === HERBS_ITEM_CODE
      ? [{ type: "RESTORE_HP_PCT", value: HERBS_HEAL_PERCENT }]
      : medicalEffects.map((effect) => ({
          type: String(effect?.type ?? "").toUpperCase(),
          value: Math.max(0, toFiniteNumber(effect?.value, 0)),
        }));

  const slotRef = findMedicalLocation(invRt, equipmentRt, itemInstanceId);
  if (!slotRef) return null;

  return {
    itemInstance,
    itemDef,
    component,
    slotRef,
    itemCode,
    effects: normalizedEffects,
    consumeTimeMs: Math.max(1000, toFiniteNumber(data?.consumeTimeMs, 45000)),
    cooldownMs: Math.max(0, toFiniteNumber(data?.cooldownMs, 0)),
  };
}

async function consumeMedicalItemUnlocked(userId, itemInstanceId) {
  const invRt = await ensureInventoryLoaded(userId);
  const eqRt = await ensureEquipmentLoaded(userId);
  const slotRef = findMedicalLocation(invRt, eqRt, itemInstanceId);
  if (!slotRef) {
    return { ok: false, code: "MEDICAL_ITEM_MISSING", invRt, eqRt };
  }

  const tx = await db.sequelize.transaction();
  try {
    if (slotRef.kind === "INVENTORY") {
      const { container, slot } = slotRef;
      const currentQty = Number(slot.qty ?? 0);
      if (currentQty <= 0) {
        return { ok: false, code: "MEDICAL_QTY_EMPTY", invRt, eqRt };
      }

      if (currentQty <= 1) {
        const consumedInstanceId = Number(slot.itemInstanceId);
        slot.itemInstanceId = null;
        slot.qty = 0;
        invRt.itemInstanceById?.delete?.(String(consumedInstanceId));

        await db.GaContainerSlot.upsert(
          {
            container_id: Number(container.id),
            slot_index: Number(slot.slotIndex),
            item_instance_id: null,
            qty: 0,
          },
          { transaction: tx }
        );

        await db.GaItemInstance.destroy({
          where: { id: consumedInstanceId },
          transaction: tx,
        });
      } else {
        slot.qty = currentQty - 1;
        await db.GaContainerSlot.upsert(
          {
            container_id: Number(container.id),
            slot_index: Number(slot.slotIndex),
            item_instance_id: Number(slot.itemInstanceId),
            qty: Number(slot.qty),
          },
          { transaction: tx }
        );
      }
    } else {
      const consumedInstanceId = Number(slotRef.equipment?.itemInstanceId);
      if (!consumedInstanceId) {
        return { ok: false, code: "MEDICAL_ITEM_MISSING", invRt, eqRt };
      }

      await db.GaEquippedItem.destroy({
        where: {
          owner_kind: "PLAYER",
          owner_id: Number(userId),
          item_instance_id: consumedInstanceId,
        },
        transaction: tx,
      });

      invRt.itemInstanceById?.delete?.(String(consumedInstanceId));
      clearEquipment(userId);
      await db.GaItemInstance.destroy({
        where: { id: consumedInstanceId },
        transaction: tx,
      });
    }

    await tx.commit();
    return { ok: true, invRt, eqRt, slotRef };
  } catch (error) {
    await tx.rollback().catch(() => {});
    throw error;
  }
}

function applyMedicalEffects(rt, itemCode, effects) {
  const hpCurrent = readRuntimeHpCurrent(rt);
  const hpMax = Math.max(0, readRuntimeHpMax(rt));
  const staminaCurrent = readRuntimeStaminaCurrent(rt);
  const staminaMax = Math.max(0, readRuntimeStaminaMax(rt));
  const immunityCurrent = readRuntimeImmunityCurrent(rt);
  const immunityMax = Math.max(100, readRuntimeImmunityMax(rt));
  const feverCurrent = readRuntimeDiseaseLevel(rt);
  const feverSeverity = readRuntimeDiseaseSeverity(rt);

  let nextHp = hpCurrent;
  let nextStamina = staminaCurrent;
  let nextImmunity = immunityCurrent;
  let nextFever = feverCurrent;

  for (const effect of Array.isArray(effects) ? effects : []) {
    const value = Math.max(0, toFiniteNumber(effect?.value, 0));
    switch (String(effect?.type ?? "").toUpperCase()) {
      case "RESTORE_HP":
        nextHp = Math.min(hpMax, nextHp + value);
        break;
      case "RESTORE_HP_PCT":
        nextHp = Math.min(hpMax, nextHp + (hpMax * value) / 100);
        break;
      case "RESTORE_STAMINA":
        nextStamina = Math.min(staminaMax, nextStamina + value);
        break;
      case "RESTORE_IMMUNITY":
        nextImmunity = Math.min(immunityMax, nextImmunity + value);
        break;
      case "REDUCE_FEVER":
        nextFever = Math.max(0, nextFever - value);
        break;
      default:
        break;
    }
  }

  const changed =
    Math.abs(nextHp - hpCurrent) > 1e-9 ||
    Math.abs(nextStamina - staminaCurrent) > 1e-9 ||
    Math.abs(nextImmunity - immunityCurrent) > 1e-9 ||
    Math.abs(nextFever - feverCurrent) > 1e-9;

  if (Math.abs(nextHp - hpCurrent) > 1e-9 || hpMax !== readRuntimeHpMax(rt)) {
    syncRuntimeHp(rt, nextHp, hpMax);
  }

  if (Math.abs(nextStamina - staminaCurrent) > 1e-9 || staminaMax !== readRuntimeStaminaMax(rt)) {
    syncRuntimeStamina(rt, nextStamina, staminaMax);
  }

  if (Math.abs(nextImmunity - immunityCurrent) > 1e-9 || immunityMax !== readRuntimeImmunityMax(rt)) {
    syncRuntimeImmunity(rt, nextImmunity, immunityMax);
  }

  if (Math.abs(nextFever - feverCurrent) > 1e-9 || feverSeverity !== readRuntimeDiseaseSeverity(rt)) {
    syncRuntimeDisease(rt, nextFever, Math.max(0, Math.min(1, 1 - nextFever / 100)));
  }

  return {
    changed,
    hpCurrent: nextHp,
    hpMax,
    staminaCurrent: nextStamina,
    staminaMax,
    immunityCurrent: nextImmunity,
    immunityMax,
    feverCurrent: nextFever,
  };
}

async function startMedicalTreatment(rt, itemInstanceId, options = {}) {
  if (!rt) {
    return { ok: false, code: "RUNTIME_NOT_LOADED", message: "Runtime not loaded" };
  }

  const userId = Number(rt.userId);
  const run = async () => {
    const invRt = await ensureInventoryLoaded(userId);
    const eqRt = await ensureEquipmentLoaded(userId);
    const medicalSpec = await getMedicalSpec(invRt, eqRt, itemInstanceId);
    if (!medicalSpec) {
      return {
        ok: false,
        code: "MEDICAL_INVALID_ITEM",
        message: "Selected item is not a valid medical consumable",
      };
    }

    const itemCode = String(medicalSpec.itemDef?.code ?? "").trim().toUpperCase();
    if (!itemCode || !hasCapability(rt, `item.medicate:${itemCode}`)) {
      return {
        ok: false,
        code: "MEDICAL_RESEARCH_LOCKED",
        message: "Medical use is not unlocked yet",
      };
    }

    const medicalState = ensureMedicalState(rt);
    const cooldownEntry = medicalState.cooldowns?.[itemCode] ?? null;
    const nowMs = Date.now();
    const timeFactor = Math.max(1, await getTimeFactor().catch(() => 1));
    const cooldownMs = resolveMedicalCooldownMs(itemCode, medicalSpec, timeFactor);
    const nextAllowedAtMs = Number(cooldownEntry?.nextAllowedAtMs ?? 0);
    if (cooldownMs > 0 && nextAllowedAtMs > nowMs) {
      return {
        ok: false,
        code: "MEDICAL_COOLDOWN_ACTIVE",
        message: "Medical item is still on cooldown",
        cooldownMs,
        nextAllowedAtMs,
      };
    }

    const consumeResult = await consumeMedicalItemUnlocked(userId, itemInstanceId);
    if (!consumeResult?.ok) {
      return consumeResult;
    }

    const treatment = applyMedicalEffects(rt, itemCode, medicalSpec.effects);
    if (!medicalState.cooldowns) medicalState.cooldowns = {};
    medicalState.cooldowns[itemCode] = {
      lastUsedAtMs: nowMs,
      cooldownMs,
      nextAllowedAtMs: nowMs + cooldownMs,
    };
    markStatsDirty(userId, nowMs);
    markRuntimeDirty(userId, nowMs);

    const inventory = buildInventoryFull(consumeResult.invRt, consumeResult.eqRt);
    inventory.macro = inventory.macro ?? {};
    inventory.macro.medical = {
      itemInstanceId: String(itemInstanceId),
      consumeTimeMs: medicalSpec.consumeTimeMs,
      cooldownMs,
      effects: medicalSpec.effects,
      nextAllowedAtMs: nowMs + cooldownMs,
    };

    return {
      ok: true,
      inventory,
      treatment,
      medicalSpec,
    };
  };

  if (options.skipLock) {
    return run();
  }

  return withInventoryLock(userId, run);
}

module.exports = {
  getMedicalSpec,
  startMedicalTreatment,
};
