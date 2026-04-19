"use strict";

const db = require("../../../models");

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

  return GaCraftDef.findAll({
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

  for (const job of jobs) {
    const startedAtMs = Number(job.started_at_ms ?? 0);
    const craftTimeMs = Number(job.craft_time_ms ?? job.craftDef?.craft_time_ms ?? job.craftDef?.craftTimeMs ?? 0);
    if (!Number.isFinite(startedAtMs) || !Number.isFinite(craftTimeMs) || craftTimeMs <= 0) continue;
    if (nowMs - startedAtMs < craftTimeMs) continue;

    await job.update({
      status: "COMPLETED",
      current_progress_ms: Math.floor(craftTimeMs),
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
