"use strict";

const db = require("../../../models");
const { getRuntime } = require("../../runtime/store");
const { markStatsDirty } = require("../../runtime/dirty");
const {
  readRuntimeStaminaCurrent,
  readRuntimeStaminaMax,
  syncRuntimeStamina,
} = require("../../movement/stamina");

function getModelValue(row, key) {
  return row?.[key] ?? row?.get?.(key) ?? null;
}

function setModelValue(row, key, value) {
  if (!row) return;
  if (typeof row.setDataValue === "function") {
    row.setDataValue(key, value);
    row[key] = value;
    return;
  }
  row[key] = value;
}

async function loadItemDefByCode(code) {
  if (!code) return null;
  return db.GaItemDef.findOne({
    where: { code },
    include: [
      {
        model: db.GaItemDefComponent,
        as: "components",
        required: false,
      },
    ],
  });
}

async function normalizeBasketTier2CraftDef(craftDef) {
  const code = String(getModelValue(craftDef, "code") ?? "").toUpperCase();
  if (code !== "CRAFT_BASKET_T2") return craftDef;

  setModelValue(craftDef, "required_skill_level", 2);
  setModelValue(craftDef, "craft_time_ms", 1800000);
  setModelValue(craftDef, "stamina_cost_total", 30);

  const basketItemDef = await loadItemDefByCode("BASKET");
  const fiberItemDef = await loadItemDefByCode("FIBER");
  if (basketItemDef && fiberItemDef) {
    setModelValue(craftDef, "recipeItems", [
      {
        id: "runtime:craft_basket_t2:basket",
        item_def_id: Number(basketItemDef.id),
        quantity: 1,
        role: "INPUT",
        sort_order: 1,
        itemDef: basketItemDef,
      },
      {
        id: "runtime:craft_basket_t2:fiber",
        item_def_id: Number(fiberItemDef.id),
        quantity: 30,
        role: "INPUT",
        sort_order: 2,
        itemDef: fiberItemDef,
      },
    ]);
  }

  return craftDef;
}

async function loadOwnersForPlayer(userId) {
  const GaContainerOwner = db.GaContainerOwner;
  return GaContainerOwner.findAll({
    where: { owner_kind: "PLAYER", owner_id: userId },
    order: [
      ["container_id", "ASC"],
      ["slot_role", "ASC"],
    ],
  });
}

async function loadContainersByIds(containerIds) {
  if (!containerIds.length) return [];
  const GaContainer = db.GaContainer;

  return GaContainer.findAll({
    where: { id: containerIds },
    order: [["id", "ASC"]],
  });
}

async function loadContainerDefsByIds(defIds) {
  if (!defIds.length) return [];
  const GaContainerDef = db.GaContainerDef;

  return GaContainerDef.findAll({
    where: { id: defIds },
    order: [["id", "ASC"]],
  });
}

async function loadSlotsByContainerIds(containerIds) {
  if (!containerIds.length) return [];
  const GaContainerSlot = db.GaContainerSlot;

  return GaContainerSlot.findAll({
    where: { container_id: containerIds },
    order: [
      ["container_id", "ASC"],
      ["slot_index", "ASC"],
    ],
  });
}

async function loadItemInstances(itemInstanceIds) {
  if (!itemInstanceIds.length) return [];
  const GaItemInstance = db.GaItemInstance;

  return GaItemInstance.findAll({
    where: { id: itemInstanceIds },
    order: [["id", "ASC"]],
  });
}

async function loadItemDefs(itemDefIds) {
  if (!itemDefIds.length) return [];
  const GaItemDef = db.GaItemDef;

  return GaItemDef.findAll({
    where: { id: itemDefIds },
    order: [["id", "ASC"]],
  });
}

async function loadItemDefComponents(itemDefIds) {
  if (!itemDefIds.length) return [];
  const GaItemDefComponent = db.GaItemDefComponent;

  return GaItemDefComponent.findAll({
    where: { item_def_id: itemDefIds },
    order: [
      ["item_def_id", "ASC"],
      ["id", "ASC"],
    ],
  });
}

async function loadActiveCraftDefs() {
  const GaCraftDef = db.GaCraftDef;

  const craftDefs = await GaCraftDef.findAll({
    where: { is_active: true },
    include: [
      {
        model: db.GaSkillDef,
        as: "skillDef",
        required: false,
      },
      {
        model: db.GaResearchDef,
        as: "requiredResearchDef",
        required: false,
      },
      {
        model: db.GaItemDef,
        as: "outputItemDef",
        required: true,
        include: [
          {
            model: db.GaItemDefComponent,
            as: "components",
            required: false,
          },
        ],
      },
      {
        model: db.GaCraftRecipeItem,
        as: "recipeItems",
        required: false,
        include: [
          {
            model: db.GaItemDef,
            as: "itemDef",
            required: true,
            include: [
              {
                model: db.GaItemDefComponent,
                as: "components",
                required: false,
              },
            ],
          },
        ],
      },
    ],
    order: [
      ["id", "ASC"],
      [{ model: db.GaCraftRecipeItem, as: "recipeItems" }, "sort_order", "ASC"],
      [{ model: db.GaCraftRecipeItem, as: "recipeItems" }, "id", "ASC"],
    ],
  });

  for (const craftDef of craftDefs) {
    await normalizeBasketTier2CraftDef(craftDef);
  }

  return craftDefs;
}

async function loadActiveCraftJobs(userId) {
  const GaUserCraftJob = db.GaUserCraftJob;
  await completeDueCraftJobs(userId);

  return GaUserCraftJob.findAll({
    where: {
      user_id: userId,
      status: ["PENDING", "RUNNING", "PAUSED", "COMPLETED"],
    },
    include: [
      {
        model: db.GaCraftDef,
        as: "craftDef",
        required: true,
        include: [
          {
            model: db.GaItemDef,
            as: "outputItemDef",
            required: true,
            include: [
              {
                model: db.GaItemDefComponent,
                as: "components",
                required: false,
              },
            ],
          },
        ],
      },
    ],
    order: [
      ["created_at", "ASC"],
      ["id", "ASC"],
    ],
  }).then(async (jobs) => {
    for (const job of jobs) {
      await normalizeBasketTier2CraftDef(job?.craftDef ?? null);
    }
    return jobs;
  });
}

async function completeDueCraftJobs(userId) {
  const jobs = await db.GaUserCraftJob.findAll({
    where: {
      user_id: userId,
      status: "RUNNING",
    },
    include: [
      {
        model: db.GaCraftDef,
        as: "craftDef",
        required: true,
      },
    ],
    order: [["id", "ASC"]],
  });
  const nowMs = Date.now();
  const now = new Date();
  const runtime = getRuntime(userId);

  for (const job of jobs) {
    await normalizeBasketTier2CraftDef(job?.craftDef ?? null);

    const startedAtMs = Number(job.started_at_ms ?? 0);
    const craftTimeMs = Number(job.craft_time_ms ?? job.craftDef?.craft_time_ms ?? job.craftDef?.craftTimeMs ?? 0);
    if (!Number.isFinite(startedAtMs) || !Number.isFinite(craftTimeMs) || craftTimeMs <= 0) continue;
    const elapsedMs = Math.max(0, nowMs - startedAtMs);
    const nextProgressMs = Math.min(craftTimeMs, elapsedMs);
    const totalStaminaCost = Math.max(0, Number(job.craftDef?.stamina_cost_total ?? job.craftDef?.staminaCostTotal ?? 0));
    const currentSpent = Math.max(0, Number(job.stamina_spent ?? 0));
    const targetSpent = craftTimeMs > 0 ? Math.min(totalStaminaCost, (totalStaminaCost * nextProgressMs) / craftTimeMs) : totalStaminaCost;
    const nextSpent = Math.max(currentSpent, targetSpent);
    const staminaDebit = Math.max(0, Math.floor(nextSpent) - Math.floor(currentSpent));

    if (staminaDebit > 0) {
      if (runtime) {
        const staminaBefore = readRuntimeStaminaCurrent(runtime);
        const staminaMax = readRuntimeStaminaMax(runtime);
        const staminaAfter = Math.max(0, staminaBefore - staminaDebit);
        syncRuntimeStamina(runtime, staminaAfter, staminaMax);
        markStatsDirty(userId);
      } else {
        const stats = await db.GaUserStats.findByPk(userId);
        if (stats) {
          const staminaBefore = Number(stats.stamina_current ?? 0);
          const staminaAfter = Math.max(0, staminaBefore - staminaDebit);
          await stats.update({ stamina_current: staminaAfter });
        }
      }
    }

    if (nextProgressMs < craftTimeMs) {
      if (nextProgressMs !== Number(job.current_progress_ms ?? 0) || nextSpent !== currentSpent) {
        await job.update({
          current_progress_ms: Math.floor(nextProgressMs),
          stamina_spent: nextSpent,
          updated_at: now,
        });
      }
      continue;
    }

    await job.update({
      status: "COMPLETED",
      current_progress_ms: Math.floor(craftTimeMs),
      stamina_spent: totalStaminaCost,
      completed_at_ms: startedAtMs + craftTimeMs,
      updated_at: now,
    });
  }
}

module.exports = {
  loadOwnersForPlayer,
  loadContainersByIds,
  loadContainerDefsByIds,
  loadSlotsByContainerIds,
  loadItemInstances,
  loadItemDefs,
  loadItemDefComponents,
  loadActiveCraftDefs,
  loadActiveCraftJobs,
  completeDueCraftJobs,
};
