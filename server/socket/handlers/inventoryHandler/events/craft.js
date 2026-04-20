"use strict";

const db = require("../../../../models");
const { withInventoryLock, markDirty, setInventory } = require("../../../../state/inventory/store");
const { loadInventoryRuntime } = require("../../../../state/inventory/loader");
const {
  loadActiveCraftDefs,
  loadActiveCraftJobs,
  completeDueCraftJobs,
} = require("../../../../state/inventory/loader/queries");
const { assertCanAddItemWeight } = require("../../../../state/inventory/weight");
const { ensureEquipmentLoaded } = require("../../../../state/equipment/loader");
const { ensureResearchLoaded } = require("../../../../service/researchService");
const { awardSkillXp } = require("../../../../service/skillProgressionService");
const { emitFullAndAck, resolveUserOrAck } = require("../context");
const { safeAck } = require("../shared");
const { getRuntime } = require("../../../../state/runtimeStore");
const { resolveFeverDebuffTempoMultiplier } = require("../../../../state/movement/status");

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isLegacyHandRole(slotRole) {
  return slotRole === "HAND_L" || slotRole === "HAND_R";
}

function getResearchLevel(research, researchDefId) {
  if (researchDefId == null) return Infinity;
  const studies = Array.isArray(research?.studies) ? research.studies : [];
  const study = studies.find((item) => Number(item.researchDefId) === Number(researchDefId));
  return toNumber(study?.currentLevel, 0);
}

function assertCraftUnlocked(craftDef, research) {
  const requiredResearchDefId = craftDef.required_research_def_id;
  if (requiredResearchDefId == null) return;

  const requiredLevel = Math.max(1, toNumber(craftDef.required_research_level, 1));
  if (getResearchLevel(research, requiredResearchDefId) < requiredLevel) {
    const err = new Error("Research required for this craft.");
    err.code = "CRAFT_RESEARCH_LOCKED";
    throw err;
  }
}

function assertCraftSkillLevel(craftDef, invRt) {
  const requiredSkillLevel = Math.max(1, toNumber(craftDef.required_skill_level ?? craftDef.requiredSkillLevel, 1));
  const craftingSkillLevel = Math.max(1, toNumber(invRt?.skills?.SKILL_CRAFTING?.currentLevel, 1));
  if (craftingSkillLevel < requiredSkillLevel) {
    const err = new Error(`Crafting level ${requiredSkillLevel} required.`);
    err.code = "CRAFT_SKILL_LOCKED";
    throw err;
  }
}

function findCraftDef(invRt, craftCode) {
  const code = String(craftCode ?? "").trim().toUpperCase();
  const craftDefs = Array.isArray(invRt?.craftDefs) ? invRt.craftDefs : [];
  return craftDefs.find((craftDef) => String(craftDef?.code ?? "").toUpperCase() === code) ?? null;
}

function collectIngredientSlots(invRt, itemDefId, quantity) {
  let remaining = Number(quantity);
  const matches = [];

  for (const container of invRt.containers ?? []) {
    if (!isLegacyHandRole(container.slotRole)) continue;

    for (const slot of container.slots ?? []) {
      if (remaining <= 0) break;
      if (slot.itemInstanceId == null || Number(slot.qty ?? 0) <= 0) continue;

      const instance = invRt.itemInstanceById?.get(String(slot.itemInstanceId)) ?? null;
      const instanceItemDefId = instance?.itemDefId ?? instance?.item_def_id ?? null;
      if (!instance || Number(instanceItemDefId) !== Number(itemDefId)) continue;

      const take = Math.min(remaining, Number(slot.qty ?? 0));
      matches.push({ container, slot, take });
      remaining -= take;
    }
  }

  if (remaining > 0) {
    const err = new Error("Put the required items in HAND_L or HAND_R first.");
    err.code = "CRAFT_MISSING_INGREDIENTS";
    throw err;
  }

  return matches;
}

async function persistSlot(tx, container, slotIndex, slot) {
  await db.GaContainerSlot.upsert(
    {
      container_id: Number(container.id),
      slot_index: Number(slotIndex),
      item_instance_id: slot.itemInstanceId == null ? null : Number(slot.itemInstanceId),
      qty: slot.itemInstanceId == null ? 0 : Number(slot.qty ?? 0),
    },
    { transaction: tx }
  );
}

async function assertNoActiveCraftJob(userId, tx) {
  const activeCount = await db.GaUserCraftJob.count({
    where: {
      user_id: Number(userId),
      status: ["PENDING", "RUNNING", "PAUSED", "COMPLETED"],
    },
    transaction: tx,
  });

  if (activeCount > 0) {
    const err = new Error("A craft is already running.");
    err.code = "CRAFT_ALREADY_RUNNING";
    throw err;
  }
}

function getCraftTimeReductionMs(craftingSkillLevel) {
  const level = Math.max(1, toNumber(craftingSkillLevel, 1));
  return Math.max(0, level - 1) * 30000;
}

function shouldIgnoreCraftTimeReduction(craftDef) {
  return String(craftDef?.code ?? "").toUpperCase() === "CRAFT_BASKET_T2";
}

function getCraftTimeForSkill(craftDef, baseCraftTimeMs, craftingSkillLevel) {
  const base = Math.max(0, toNumber(baseCraftTimeMs, 0));
  if (shouldIgnoreCraftTimeReduction(craftDef)) {
    return base;
  }
  const reduced = base - getCraftTimeReductionMs(craftingSkillLevel);
  return Math.max(1000, reduced);
}

function findOutputSlot(invRt) {
  let emptyHandSlot = null;

  for (const container of invRt.containers ?? []) {
    const slotIndex = (container.slots ?? []).findIndex((slot) => slot.itemInstanceId == null);
    if (slotIndex < 0) continue;

    if (isLegacyHandRole(container.slotRole)) {
      if (!emptyHandSlot) {
        emptyHandSlot = { container, slot: container.slots[slotIndex], slotIndex };
      }
      continue;
    }

    return { container, slot: container.slots[slotIndex], slotIndex };
  }

  if (emptyHandSlot) {
    return emptyHandSlot;
  }

  const err = new Error("No empty inventory or hand slot.");
  err.code = "CRAFT_NO_FREE_SLOT";
  throw err;
}

async function startCraftJob(invRt, craftDef, tx) {
  const recipeItems = Array.isArray(craftDef.recipeItems) ? craftDef.recipeItems : [];
  const inputItems = recipeItems.filter((item) => String(item.role ?? "INPUT").toUpperCase() === "INPUT");
  const ingredientGroups = [];
  const touchedContainers = new Set();
  const touchedSlots = [];

  for (const item of inputItems) {
    const quantity = Number(item.quantity ?? 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      const err = new Error("Invalid craft recipe.");
      err.code = "CRAFT_INVALID_RECIPE";
      throw err;
    }

    ingredientGroups.push({
      itemDefId: item.item_def_id,
      quantity,
      slots: collectIngredientSlots(invRt, item.item_def_id, quantity),
    });
  }

  await assertNoActiveCraftJob(invRt.userId, tx);

  const craftingSkillLevel = Math.max(1, toNumber(invRt?.skills?.SKILL_CRAFTING?.currentLevel, 1));
  const baseCraftTimeMs = toNumber(craftDef.craft_time_ms ?? craftDef.craftTimeMs, 0);
  const rt = getRuntime(invRt.userId);
  const feverTempoMultiplier = resolveFeverDebuffTempoMultiplier(
    rt?.status?.fever?.current ?? rt?.diseaseLevel ?? rt?.stats?.diseaseLevel ?? 100,
    rt?.status?.fever?.severity ?? rt?.diseaseSeverity ?? rt?.stats?.diseaseSeverity ?? 0
  );
  const craftTimeMs = Math.max(
    1000,
    Math.round(getCraftTimeForSkill(craftDef, baseCraftTimeMs, craftingSkillLevel) * feverTempoMultiplier)
  );
  const staminaCostTotal = Math.max(0, toNumber(craftDef.stamina_cost_total ?? craftDef.staminaCostTotal, 0));
  // A stamina entra como custo do job na largada; o cooldown do craft
  // é o que segura a entrega do item até completar os 30 minutos.

  for (const group of ingredientGroups) {
    for (const match of group.slots) {
      const slotIndex = match.container.slots.indexOf(match.slot);
      match.slot.qty = Number(match.slot.qty ?? 0) - match.take;
      if (match.slot.qty <= 0) {
        if (match.slot.itemInstanceId != null) {
          invRt.itemInstanceById?.delete(String(match.slot.itemInstanceId));
        }
        match.slot.itemInstanceId = null;
        match.slot.qty = 0;
      }
      touchedContainers.add(String(match.container.id));
      touchedSlots.push({ container: match.container, slotIndex, slot: match.slot });
    }
  }

  for (const touched of touchedSlots) {
    await persistSlot(tx, touched.container, touched.slotIndex, touched.slot);
  }

  const now = new Date();
  const job = await db.GaUserCraftJob.create(
    {
      user_id: Number(invRt.userId),
      craft_def_id: Number(craftDef.id),
      status: "RUNNING",
      current_progress_ms: 0,
      stamina_spent: 0,
      craft_time_ms: craftTimeMs,
      started_at_ms: Date.now(),
      paused_at_ms: null,
      completed_at_ms: null,
      created_at: now,
      updated_at: now,
    },
    { transaction: tx }
  );

  if (touchedContainers.size) {
    await db.GaContainer.update(
      { rev: db.Sequelize.literal("rev + 1") },
      { where: { id: Array.from(touchedContainers) }, transaction: tx }
    );
  }

  for (const containerId of touchedContainers) {
    const container = invRt.containersById?.get(String(containerId)) ?? null;
    if (container) container.rev = Number(container.rev ?? 0) + 1;
    markDirty(invRt.userId, containerId);
  }

  return job;
}

async function findCompletedCraftJob(userId, jobId, tx) {
  await completeDueCraftJobs(userId);

  const job = await db.GaUserCraftJob.findOne({
    where: {
      id: Number(jobId),
      user_id: Number(userId),
      status: "COMPLETED",
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
    transaction: tx,
  });

  if (!job) {
    const err = new Error("No completed craft to collect.");
    err.code = "CRAFT_NOT_READY";
    throw err;
  }

  return job;
}

async function claimCraftJob(invRt, eqRt, research, jobId, tx) {
  const job = await findCompletedCraftJob(invRt.userId, jobId, tx);
  const craftDef = job.craftDef;
  const output = findOutputSlot(invRt);
  const outputQty = Math.max(1, Number(craftDef.output_qty ?? craftDef.outputQty ?? 1));

  assertCanAddItemWeight(invRt, eqRt, research, craftDef.outputItemDef, outputQty);

  const created = await db.GaItemInstance.create(
    {
      item_def_id: Number(craftDef.output_item_def_id ?? craftDef.outputItemDef?.id),
      owner_user_id: Number(invRt.userId),
      bind_state: "NONE",
      durability: null,
      props_json: null,
    },
    { transaction: tx }
  );

  output.slot.itemInstanceId = String(created.id);
  output.slot.qty = outputQty;
  await persistSlot(tx, output.container, output.slotIndex, output.slot);

  invRt.itemInstanceById.set(String(created.id), {
    id: String(created.id),
    userId: String(invRt.userId),
    itemDefId: String(craftDef.output_item_def_id ?? craftDef.outputItemDef?.id),
    props: null,
    durability: null,
  });

  if (craftDef.outputItemDef) {
    invRt.itemDefsById.set(String(craftDef.outputItemDef.id), craftDef.outputItemDef);
  }

  await db.GaContainer.update(
    { rev: db.Sequelize.literal("rev + 1") },
    { where: { id: Number(output.container.id) }, transaction: tx }
  );

  const container = invRt.containersById?.get(String(output.container.id)) ?? null;
  if (container) container.rev = Number(container.rev ?? 0) + 1;
  markDirty(invRt.userId, output.container.id);

  const xpReward = Number(craftDef.xp_reward ?? craftDef.xpReward ?? 0);
  await awardSkillXp(invRt.userId, "SKILL_CRAFTING", xpReward, tx);

  await job.destroy({ transaction: tx });
}

function registerCraftEvent(socket) {
  socket.on("craft:start", (intent = {}, ack) => {
    const userId = resolveUserOrAck(socket, ack);
    if (!userId) return;

    withInventoryLock(userId, async () => {
      try {
        const craftCode = intent?.craftCode ?? intent?.code;
        const invRt = await loadInventoryRuntime(userId);
        setInventory(userId, invRt);
        const eqRt = await ensureEquipmentLoaded(userId);
        const rt = require("../../../../state/runtimeStore").getRuntime(userId);
        const research = await ensureResearchLoaded(userId, rt ?? { userId });
        invRt.research = research;

        if (!Array.isArray(invRt.craftDefs) || invRt.craftDefs.length === 0) {
          invRt.craftDefs = await loadActiveCraftDefs();
        }

        const craftDef = findCraftDef(invRt, craftCode);
        if (!craftDef) {
          safeAck(ack, { ok: false, code: "CRAFT_NOT_FOUND", message: "Craft not found." });
          return;
        }

        assertCraftUnlocked(craftDef, research);
        assertCraftSkillLevel(craftDef, invRt);

        await db.sequelize.transaction(async (tx) => {
          await startCraftJob(invRt, craftDef, tx);
        });

        invRt.craftJobs = await loadActiveCraftJobs(userId);
        await emitFullAndAck(socket, invRt, eqRt, ack);
      } catch (e) {
        try {
          const freshInvRt = await loadInventoryRuntime(userId);
          setInventory(userId, freshInvRt);
          const freshEqRt = await ensureEquipmentLoaded(userId);
          await emitFullAndAck(socket, freshInvRt, freshEqRt, null);
        } catch (reloadErr) {
          console.warn("[CRAFT] failed to refresh inventory after craft error", {
            userId,
            error: String(reloadErr?.message || reloadErr),
          });
        }

        safeAck(ack, {
          ok: false,
          code: e.code || "CRAFT_ERR",
          message: e.message || "Craft failed.",
        });
      }
    });
  });

  socket.on("craft:claim", (intent = {}, ack) => {
    const userId = resolveUserOrAck(socket, ack);
    if (!userId) return;

    withInventoryLock(userId, async () => {
      try {
        const jobId = intent?.jobId ?? intent?.id;
        const invRt = await loadInventoryRuntime(userId);
        setInventory(userId, invRt);
        const eqRt = await ensureEquipmentLoaded(userId);
        const rt = require("../../../../state/runtimeStore").getRuntime(userId);
        const research = await ensureResearchLoaded(userId, rt ?? { userId });
        invRt.research = research;

        await db.sequelize.transaction(async (tx) => {
          await claimCraftJob(invRt, eqRt, research, jobId, tx);
        });

        invRt.craftJobs = await loadActiveCraftJobs(userId);
        await emitFullAndAck(socket, invRt, eqRt, ack);
      } catch (e) {
        try {
          const freshInvRt = await loadInventoryRuntime(userId);
          setInventory(userId, freshInvRt);
          const freshEqRt = await ensureEquipmentLoaded(userId);
          await emitFullAndAck(socket, freshInvRt, freshEqRt, null);
        } catch (reloadErr) {
          console.warn("[CRAFT] failed to refresh inventory after craft claim error", {
            userId,
            error: String(reloadErr?.message || reloadErr),
          });
        }

        safeAck(ack, {
          ok: false,
          code: e.code || "CRAFT_CLAIM_ERR",
          message: e.message || "Craft collect failed.",
        });
      }
    });
  });
}

module.exports = {
  registerCraftEvent,
};
