"use strict";

const db = require("../../../models");
const { loadCarryWeightStats } = require("../weight");
const { ensureEquipmentLoaded } = require("../../equipment/loader");
const {
  ensureGrantedContainerForItem,
  getGrantedContainerSlotRole,
} = require("../../../service/equipmentService/grantsContainer");
const {
  ensurePrimitiveShelterMaterialsContainer,
  getPrimitiveShelterMaterialsSlotRole,
} = require("../../../service/buildMaterialsService");
const {
  loadOwnersForPlayer,
  loadContainersByIds,
  loadContainerDefsByIds,
  loadSlotsByContainerIds,
  loadItemInstances,
  loadItemDefs,
  loadItemDefComponents,
  loadActiveCraftDefs,
  loadActiveCraftJobs,
} = require("./queries");
const { loadUserSkillSummaries } = require("../../../service/skillProgressionService");
const {
  uniq,
  makeEmptySlots,
  ensureSlotCapacity,
  normalizeOwnerRow,
  normalizeContainerRow,
  normalizeContainerDefRow,
  normalizeSlotRow,
  normalizeItemInstanceRow,
  normalizeItemDefRow,
  normalizeItemDefComponentRow,
} = require("./normalize");

function hasGrantedContainerComponent(def) {
  const components = Array.isArray(def?.components) ? def.components : [];
  return components.some((component) => {
    const type = String(component?.componentType ?? component?.component_type ?? "").toUpperCase();
    return type === "GRANTS_CONTAINER";
  });
}

function getGrantedContainerComponent(def) {
  const components = Array.isArray(def?.components) ? def.components : [];
  return (
    components.find((component) => {
      const type = String(component?.componentType ?? component?.component_type ?? "").toUpperCase();
      return type === "GRANTS_CONTAINER";
    }) ?? null
  );
}

function firstEmptySlot(container) {
  if (!container || !Array.isArray(container.slots)) return null;
  const slotIndex = container.slots.findIndex((slot) => !slot?.itemInstanceId);
  if (slotIndex < 0) return null;
  return { container, slotIndex, slot: container.slots[slotIndex] };
}

async function repairSelfContainedGrantedContainers(invRt, equipmentRt) {
  const repairOps = [];
  const equipmentSlots = Object.values(equipmentRt?.equipmentBySlotCode ?? {});

  for (const equipped of equipmentSlots) {
    const itemDef = equipped?.itemDef ?? null;
    if (!itemDef || !hasGrantedContainerComponent(itemDef)) continue;

    const sourceRole = String(equipped.slotCode ?? "").trim();
    if (!sourceRole) continue;

    const grantedRole = getGrantedContainerSlotRole(itemDef, sourceRole);
    const grantedContainer = invRt.containersByRole.get(grantedRole) ?? null;
    if (!grantedContainer) continue;

    const selfSlot = (grantedContainer.slots ?? []).find(
      (slot) => String(slot?.itemInstanceId ?? "") === String(equipped.itemInstanceId ?? "")
    );
    if (!selfSlot) continue;

    const sourceContainer = invRt.containersByRole.get(sourceRole) ?? null;
    let target = firstEmptySlot(sourceContainer);
    if (!target) {
      target = invRt.containers.find((container) => {
        const role = String(container?.slotRole ?? "");
        if (!role || role.startsWith("GRANTED:")) return false;
        if (role === sourceRole) return false;
        return Array.isArray(container?.slots) && container.slots.some((slot) => !slot?.itemInstanceId);
      });
      target = target ? firstEmptySlot(target) : null;
    }

    if (!target) continue;

    const carriedQty = Number(selfSlot.qty ?? 1);
    repairOps.push(async () => {
      await db.GaContainerSlot.update(
        { item_instance_id: null, qty: 0 },
        {
          where: {
            container_id: grantedContainer.id,
            slot_index: selfSlot.slotIndex,
          },
        }
      );

      await db.GaContainerSlot.upsert({
        container_id: target.container.id,
        slot_index: target.slotIndex,
        item_instance_id: Number(equipped.itemInstanceId),
        qty: carriedQty,
      });

      selfSlot.itemInstanceId = null;
      selfSlot.qty = 0;
      target.slot.itemInstanceId = String(equipped.itemInstanceId);
      target.slot.qty = carriedQty;
    });
  }

  for (const op of repairOps) {
    await op();
  }
}

async function loadInventoryRuntime(userIdRaw, options = {}) {
  const userId = String(userIdRaw);
  const { ensureStarterInventory } = require("../../../service/inventoryProvisioning");

  await ensureStarterInventory(userId);
  const equipmentRt = await ensureEquipmentLoaded(userId);

  const [shelterRows] = await db.sequelize.query(
    `
    SELECT a.id, a.state_json
    FROM ga_actor_runtime a
    INNER JOIN ga_actor_def ad ON ad.id = a.actor_def_id
    WHERE ad.code = 'PRIMITIVE_SHELTER'
      AND a.status = 'ACTIVE'
      AND CAST(JSON_UNQUOTE(JSON_EXTRACT(a.state_json, '$.ownerUserId')) AS UNSIGNED) = :userId
    `,
    {
      replacements: { userId: Number(userId) },
    }
  );

  for (const row of shelterRows ?? []) {
    const actorId = Number(row?.id ?? 0);
    if (!Number.isInteger(actorId) || actorId <= 0) continue;

    let state = null;
    try {
      state = typeof row?.state_json === "string" ? JSON.parse(row.state_json) : row?.state_json ?? null;
    } catch {
      state = null;
    }

    const constructionState = String(state?.constructionState ?? state?.construction_state ?? "PLANNED")
      .trim()
      .toUpperCase();
    if (constructionState === "COMPLETED" || constructionState === "DISABLED") continue;

    const buildRequirements = Array.isArray(state?.buildRequirements) && state.buildRequirements.length
      ? state.buildRequirements
      : [];
    const slotRole =
      String(state?.buildMaterialsSlotRole ?? state?.build_materials_slot_role ?? getPrimitiveShelterMaterialsSlotRole(actorId)).trim() ||
      getPrimitiveShelterMaterialsSlotRole(actorId);

    const existingOwner = await db.GaContainerOwner.findOne({
      where: {
        owner_kind: "PLAYER",
        owner_id: Number(userId),
        slot_role: slotRole,
      },
    });
    if (existingOwner) continue;

    await ensurePrimitiveShelterMaterialsContainer({
      userId: Number(userId),
      actorId,
      slotCount: Math.max(1, Array.isArray(buildRequirements) ? buildRequirements.length : 1),
    });
  }

  for (const equipped of Object.values(equipmentRt?.equipmentBySlotCode ?? {})) {
    if (!equipped?.itemDef?.components?.length) continue;

    const hasGrantedContainer = equipped.itemDef.components.some((component) => {
      const type = String(component?.componentType ?? component?.component_type ?? "").toUpperCase();
      return type === "GRANTS_CONTAINER";
    });

    if (!hasGrantedContainer) continue;

    await ensureGrantedContainerForItem({
      playerId: userId,
      slotCode: equipped.slotCode,
      itemDef: equipped.itemDef,
    });
  }

  const ownerRows = await loadOwnersForPlayer(userId);
  const owners = ownerRows.map(normalizeOwnerRow);

  const containerIds = uniq(owners.map((o) => o.containerId));
  const containerRows = await loadContainersByIds(containerIds);

  const containersById = new Map();
  for (const row of containerRows) {
    const c = normalizeContainerRow(row);
    containersById.set(c.id, c);
  }

  for (const o of owners) {
    const c = containersById.get(o.containerId);
    if (!c) continue;
    if (c.slotRole == null) c.slotRole = o.slotRole;
  }

  const defIds = uniq(
    Array.from(containersById.values())
      .map((c) => c.containerDefId)
      .filter(Boolean)
  );

  const defRows = await loadContainerDefsByIds(defIds);
  const defsById = new Map();
  for (const row of defRows) {
    const d = normalizeContainerDefRow(row);
    defsById.set(d.id, d);
  }

  for (const c of containersById.values()) {
    const d = c.containerDefId ? defsById.get(c.containerDefId) : null;
    c.def = d;
    c.slotCount = d?.slotCount ?? 0;
    c.slots = makeEmptySlots(c.slotCount);
  }

  const containerIdsList = Array.from(containersById.keys());
  const slotRows = await loadSlotsByContainerIds(containerIdsList);
  for (const row of slotRows) {
    const s = normalizeSlotRow(row);
    const c = containersById.get(s.containerId);
    if (!c) continue;
    if (s.slotIndex < 0) continue;

    ensureSlotCapacity(c, s.slotIndex);
    c.slots[s.slotIndex].itemInstanceId = s.itemInstanceId;
    c.slots[s.slotIndex].qty = s.qty;
  }

  for (const c of containersById.values()) {
    c.slotCount = c.slots.length;
    if (c.def) c.def.slotCount = c.slotCount;
  }

  const containers = Array.from(containersById.values()).sort((a, b) => Number(a.id) - Number(b.id));

  const containersByRole = new Map();
  for (const c of containers) {
    if (c.slotRole) containersByRole.set(c.slotRole, c);
  }

  await repairSelfContainedGrantedContainers(
    {
      containers,
      containersByRole,
    },
    equipmentRt
  );

  const itemInstanceIds = uniq(
    containers
      .flatMap((c) => c.slots ?? [])
      .map((s) => s.itemInstanceId)
      .filter((x) => x != null)
  );

  const itemInstanceRows = await loadItemInstances(itemInstanceIds);
  const itemInstanceById = new Map();
  for (const row of itemInstanceRows) {
    const it = normalizeItemInstanceRow(row, userId);
    itemInstanceById.set(String(it.id), it);
  }

  const itemDefIds = uniq(
    Array.from(itemInstanceById.values())
      .map((it) => it.itemDefId)
      .filter(Boolean)
  );

  const itemDefRows = await loadItemDefs(itemDefIds);
  const itemDefsById = new Map();
  for (const row of itemDefRows) {
    const d = normalizeItemDefRow(row);
    itemDefsById.set(String(d.id), d);
  }

  const itemDefComponentRows = await loadItemDefComponents(itemDefIds);
  const itemDefComponentsById = new Map();
  for (const row of itemDefComponentRows) {
    const c = normalizeItemDefComponentRow(row);
    const key = String(c.itemDefId);
    const list = itemDefComponentsById.get(key) || [];
    list.push(c);
    itemDefComponentsById.set(key, list);
  }

  for (const [id, def] of itemDefsById.entries()) {
    def.components = itemDefComponentsById.get(String(id)) || [];
  }

  if (!options.skipGrantedContainerRepair) {
    let createdGrantedContainer = false;
    for (const container of containers) {
      const sourceRole = String(container?.slotRole ?? "").trim();
      if (!sourceRole || sourceRole.startsWith("GRANTED:")) continue;

      for (const slot of container?.slots ?? []) {
        if (!slot?.itemInstanceId) continue;

        const itemInstance = itemInstanceById.get(String(slot.itemInstanceId)) || null;
        if (!itemInstance) continue;

        const itemDef = itemDefsById.get(String(itemInstance.itemDefId)) || null;
        if (!itemDef || !hasGrantedContainerComponent(itemDef)) continue;

        const result = await ensureGrantedContainerForItem({
          playerId: userId,
          slotCode: sourceRole,
          itemDef,
        });

        if (result?.created) {
          createdGrantedContainer = true;
        }
      }
    }

    if (createdGrantedContainer) {
      return loadInventoryRuntime(userId, { skipGrantedContainerRepair: true });
    }
  }

  const carryWeight = await loadCarryWeightStats(userId);
  const craftDefs = await loadActiveCraftDefs();
  const craftJobs = await loadActiveCraftJobs(userId);
  const skills = await loadUserSkillSummaries(userId, [
    "SKILL_CRAFTING",
    "SKILL_BUILDING",
    "SKILL_COOKING",
    "SKILL_GATHERING",
  ]);

  return {
    userId,
    containersByRole,
    containersById,
    itemInstanceById,
    heldState: null,
    carryWeight,
    containers,
    itemDefsById,
    craftDefs,
    craftJobs,
    skills,
    dirtyContainers: new Set(),
    loadedAtMs: Date.now(),
  };
}

async function ensureInventoryLoaded(userId) {
  const { getInventory, setInventory } = require("../store");
  const key = String(userId);

  const cached = getInventory(key);
  if (cached) return cached;

  const rt = await loadInventoryRuntime(key);
  setInventory(key, rt);
  return rt;
}

module.exports = {
  loadInventoryRuntime,
  ensureInventoryLoaded,
};
