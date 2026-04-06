"use strict";

const db = require("../models");
const { getRuntime } = require("../state/runtime/store");
const { ensureInventoryLoaded } = require("../state/inventory/loader");
const { withInventoryLock } = require("../state/inventory/store");
const { flush } = require("../state/inventory/persist/flush");

const STATUS_IDLE = "IDLE";
const STATUS_RUNNING = "RUNNING";
const STATUS_COMPLETED = "COMPLETED";
const PROGRESS_PERSIST_STEP_MS = 1000;
let cachedResearchLevelColumns = null;

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseJsonObject(value, fallback = {}) {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return typeof value === "object" ? value : fallback;
}

function normalizeUnlocks(value) {
  return (Array.isArray(value?.unlock) ? value.unlock : [])
    .map((entry) => String(entry))
    .filter(Boolean);
}

function normalizeItemCosts(value) {
  return (Array.isArray(value?.itemCosts) ? value.itemCosts : [])
    .map((entry) => {
      const qty = Math.floor(toFiniteNumber(entry?.qty, 0));
      const itemCode = entry?.itemCode != null ? String(entry.itemCode) : null;
      const itemDefId = entry?.itemDefId != null ? String(entry.itemDefId) : null;

      return {
        itemCode,
        itemDefId,
        qty,
      };
    })
    .filter((entry) => entry.qty > 0 && (entry.itemCode || entry.itemDefId));
}

function normalizeItemCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
}

function canonicalResearchItemCode(value) {
  const normalized = normalizeItemCode(value);
  if (
    normalized === "STONE" ||
    normalized === "SMALLSTONE" ||
    normalized === "SMALL_STONE" ||
    normalized === "MATERIALSTONE" ||
    normalized === "MATERIAL_STONE" ||
    normalized === "AMMO_SMALL_ROCK"
  ) {
    return "SMALL_STONE";
  }
  return normalized;
}

function resolveCurrentStudy(levels, activeLevel) {
  if (!Array.isArray(levels) || levels.length === 0) return null;
  return (
    levels.find((level) => Number(level.level) === Number(activeLevel)) ??
    levels[levels.length - 1] ??
    null
  );
}

function buildStudyPayload(study) {
  const currentStudy = resolveCurrentStudy(study.levels, Math.max(1, study.currentLevel));
  const nextStudy = resolveCurrentStudy(study.levels, study.activeLevel);
  const levelStudyTimeMs = toFiniteNumber(nextStudy?.studyTimeMs, 0);
  const progressMs = clamp(toFiniteNumber(study.progressMs, 0), 0, Math.max(0, levelStudyTimeMs));
  const progressRatio = levelStudyTimeMs > 0 ? clamp(progressMs / levelStudyTimeMs, 0, 1) : 0;

  return {
    researchDefId: Number(study.researchDefId),
    code: study.code,
    name: study.name,
    description: study.description ?? null,
    status: study.status,
    currentLevel: Number(study.currentLevel ?? 0),
    activeLevel: Number(study.activeLevel ?? 1),
    maxLevel: Number(study.maxLevel ?? 1),
    progressMs,
    levelStudyTimeMs,
    progressRatio,
    startedAtMs: study.startedAtMs ?? null,
    currentLevelTitle: currentStudy?.title ?? null,
    currentLevelDescription: currentStudy?.description ?? null,
    levelTitle: nextStudy?.title ?? null,
    levelDescription: nextStudy?.description ?? null,
    nextLevelTitle: nextStudy?.title ?? null,
    nextLevelDescription: nextStudy?.description ?? null,
    levelRequirements: nextStudy?.requirements ?? null,
    levelItemCosts: normalizeItemCosts(nextStudy?.requirements),
    canStart: Boolean(study.canStart),
    isRunning: study.status === STATUS_RUNNING,
    isCompleted: study.status === STATUS_COMPLETED,
    itemDef: study.itemDef
      ? {
          id: Number(study.itemDef.id),
          code: study.itemDef.code,
          name: study.itemDef.name,
          category: study.itemDef.category,
        }
      : null,
  };
}

function buildResearchPayload(rt) {
  const research = rt?.research;
  const studies = Array.isArray(research?.studies) ? research.studies : [];
  return {
    ok: true,
    serverNowMs: Date.now(),
    activeResearchCode: research?.activeResearchCode ?? null,
    studies: studies.map(buildStudyPayload),
  };
}

async function loadResearchDefinitions() {
  if (!cachedResearchLevelColumns) {
    try {
      const table = await db.sequelize.getQueryInterface().describeTable("ga_research_level_def");
      cachedResearchLevelColumns = new Set(Object.keys(table ?? {}));
    } catch {
      cachedResearchLevelColumns = new Set();
    }
  }

  const levelAttributes = [
    "id",
    "research_def_id",
    "level",
    "study_time_ms",
    "grants_json",
    "requirements_json",
  ];

  if (cachedResearchLevelColumns.has("title")) {
    levelAttributes.push("title");
  }
  if (cachedResearchLevelColumns.has("description")) {
    levelAttributes.push("description");
  }

  return db.GaResearchDef.findAll({
    where: { is_active: true },
    include: [
      {
        model: db.GaResearchLevelDef,
        as: "levels",
        attributes: levelAttributes,
      },
      {
        model: db.GaItemDef,
        as: "itemDef",
        required: false,
      },
    ],
    order: [
      ["id", "ASC"],
      [{ model: db.GaResearchLevelDef, as: "levels" }, "level", "ASC"],
    ],
  });
}

async function ensureUserResearchRows(userId, defs, transaction = null) {
  const rows = await db.GaUserResearch.findAll({
    where: { user_id: Number(userId) },
    transaction,
  });

  const byResearchDefId = new Map(rows.map((row) => [Number(row.research_def_id), row]));
  for (const def of defs) {
    const researchDefId = Number(def.id);
    if (byResearchDefId.has(researchDefId)) continue;

    const created = await db.GaUserResearch.create(
      {
        user_id: Number(userId),
        research_def_id: researchDefId,
        current_level: 0,
        status: STATUS_IDLE,
        active_level: 1,
        progress_ms: 0,
        started_at_ms: null,
        completed_at_ms: null,
      },
      { transaction }
    );

    rows.push(created);
    byResearchDefId.set(researchDefId, created);
  }

  return rows;
}

function buildResearchRuntime(defs, userRows) {
  const userByDefId = new Map(userRows.map((row) => [Number(row.research_def_id), row]));

  const studies = defs.map((def) => {
    const row = userByDefId.get(Number(def.id));
    const levels = (Array.isArray(def.levels) ? def.levels : []).map((level) => ({
      level: Number(level.level),
      studyTimeMs: toFiniteNumber(level.study_time_ms, 0),
      title: level.title ?? null,
      description: level.description ?? null,
      grants: parseJsonObject(level.grants_json ?? level.grantsJson, { unlock: [] }),
      requirements: parseJsonObject(level.requirements_json ?? level.requirementsJson, {}),
    }));
    const maxLevel = Number(def.max_level ?? levels.length ?? 1);
    const currentLevel = clamp(toFiniteNumber(row?.current_level, 0), 0, maxLevel);
    const activeLevel = clamp(
      toFiniteNumber(row?.active_level, currentLevel >= maxLevel ? maxLevel : currentLevel + 1),
      1,
      Math.max(1, maxLevel)
    );
    const status =
      currentLevel >= maxLevel
        ? STATUS_COMPLETED
        : String(row?.status ?? STATUS_IDLE).toUpperCase() === STATUS_RUNNING
          ? STATUS_RUNNING
          : STATUS_IDLE;
    const levelStudyTimeMs = toFiniteNumber(resolveCurrentStudy(levels, activeLevel)?.studyTimeMs, 0);
    const nextStudy = resolveCurrentStudy(levels, activeLevel);
    const progressMs =
      status === STATUS_COMPLETED
        ? 0
        : clamp(toFiniteNumber(row?.progress_ms, 0), 0, Math.max(0, levelStudyTimeMs));

    return {
      researchDefId: Number(def.id),
      code: def.code,
      name: def.name,
      description: def.description ?? null,
      maxLevel,
      currentLevel,
      activeLevel,
      progressMs,
      status,
      startedAtMs: row?.started_at_ms == null ? null : toFiniteNumber(row.started_at_ms, null),
      completedAtMs: row?.completed_at_ms == null ? null : toFiniteNumber(row.completed_at_ms, null),
      levelRequirements: nextStudy?.requirements ?? null,
      levelItemCosts: normalizeItemCosts(nextStudy?.requirements),
      levels,
      itemDef: def.itemDef
        ? {
            id: Number(def.itemDef.id),
            code: def.itemDef.code,
            name: def.itemDef.name,
            category: def.itemDef.category,
          }
        : null,
      dirty: false,
      forcePersist: false,
      lastPersistBucket: Math.floor(progressMs / PROGRESS_PERSIST_STEP_MS),
      canStart: currentLevel < maxLevel,
    };
  });

  const running = studies.find((study) => study.status === STATUS_RUNNING) ?? null;
  for (const study of studies) {
    study.canStart =
      study.currentLevel < study.maxLevel &&
      study.status !== STATUS_RUNNING &&
      (!running || running.code === study.code);
  }

  return {
    activeResearchCode: running?.code ?? null,
    studies,
  };
}

async function ensureResearchLoaded(userId, rt = getRuntime(userId), options = {}) {
  const holder = rt ?? { userId: Number(userId) };
  const forceReload = Boolean(options?.forceReload);

  if (!forceReload && holder.research?.studies?.length > 0) {
    return holder.research;
  }

  const defs = await loadResearchDefinitions();
  const userRows = await ensureUserResearchRows(userId, defs);
  holder.research = buildResearchRuntime(defs, userRows);
  return holder.research;
}

function listUnlockedCapabilities(rt) {
  const studies = Array.isArray(rt?.research?.studies) ? rt.research.studies : [];
  const unlocks = new Set();

  for (const study of studies) {
    const completedLevels = Math.max(0, toFiniteNumber(study.currentLevel, 0));
    for (const level of study.levels ?? []) {
      if (Number(level.level) > completedLevels) continue;
      for (const unlockCode of normalizeUnlocks(level.grants)) {
        unlocks.add(unlockCode);
      }
    }
  }

  return unlocks;
}

function findItemDefByCode(invRt, itemCode) {
  if (!invRt?.itemDefsById || !itemCode) return null;
  const target = canonicalResearchItemCode(itemCode);
  for (const def of invRt.itemDefsById.values()) {
    if (canonicalResearchItemCode(def?.code) === target) {
      return def;
    }
  }
  return null;
}

function resolveCostItemDef(invRt, cost) {
  if (cost?.itemDefId != null) {
    return invRt?.itemDefsById?.get?.(String(cost.itemDefId)) || null;
  }
  return findItemDefByCode(invRt, cost?.itemCode ?? null);
}

async function resolveCostItemDefFresh(invRt, cost) {
  const cached = resolveCostItemDef(invRt, cost);
  if (cached) return cached;

  if (cost?.itemDefId != null) {
    const row = await db.GaItemDef.findByPk(Number(cost.itemDefId));
    if (row) {
      return {
        id: Number(row.id),
        code: row.code,
        name: row.name,
        category: row.category ?? row.categoria ?? null,
      };
    }
  }

  if (cost?.itemCode != null) {
    const aliases = Array.from(
      new Set([
        canonicalResearchItemCode(cost.itemCode),
        normalizeItemCode(cost.itemCode),
        String(cost.itemCode),
      ])
    ).filter(Boolean);

    for (const alias of aliases) {
      const row = await db.GaItemDef.findOne({ where: { code: alias } });
      if (row) {
        return {
          id: Number(row.id),
          code: row.code,
          name: row.name,
          category: row.category ?? row.categoria ?? null,
        };
      }
    }
  }

  return null;
}

async function consumeResearchItemCosts(userId, invRt, requirements, tx) {
  const itemCosts = normalizeItemCosts(requirements);
  if (itemCosts.length === 0) {
    return {
      touchedContainers: [],
      touchedSlots: [],
      consumedInstanceIds: [],
    };
  }

  const touchedContainers = new Set();
  const touchedSlots = new Map();
  const consumedInstanceIds = new Set();

  for (const cost of itemCosts) {
    const itemDef = await resolveCostItemDefFresh(invRt, cost);
    if (!itemDef) {
      throw Object.assign(new Error(`Research item cost not found: ${cost.itemCode ?? cost.itemDefId}`), {
        code: "RESEARCH_COST_ITEM_DEF_NOT_FOUND",
      });
    }

    const targetItemDefId = String(itemDef.id);
    const matchingSlots = [];
    let availableQty = 0;

    for (const container of invRt?.containers ?? []) {
      for (const slot of container?.slots ?? []) {
        const slotQty = Number(slot?.qty ?? 0);
        if (slotQty <= 0 || !slot?.itemInstanceId) continue;

        const itemInstance = invRt?.itemInstanceById?.get?.(String(slot.itemInstanceId)) ?? null;
        if (!itemInstance) continue;
        if (String(itemInstance.itemDefId) !== targetItemDefId) continue;

        availableQty += slotQty;
        matchingSlots.push({ container, slot, itemInstance });
      }
    }

    if (availableQty < cost.qty) {
      throw Object.assign(
        new Error(
          `Not enough ${itemDef.name ?? itemDef.code ?? cost.itemCode ?? "items"} (${availableQty}/${cost.qty})`
        ),
        {
          code: "RESEARCH_COST_NOT_ENOUGH_ITEMS",
          meta: {
            itemCode: itemDef.code ?? cost.itemCode ?? null,
            itemName: itemDef.name ?? null,
            have: availableQty,
            need: cost.qty,
          },
        }
      );
    }

    let remaining = cost.qty;
    for (const match of matchingSlots) {
      if (remaining <= 0) break;

      const currentQty = Number(match.slot.qty ?? 0);
      if (currentQty <= 0) continue;

      const consumeQty = Math.min(currentQty, remaining);
      if (consumeQty <= 0) continue;

      remaining -= consumeQty;
      const nextQty = currentQty - consumeQty;

      if (nextQty <= 0) {
        const consumedInstanceId = String(match.slot.itemInstanceId);
        match.slot.itemInstanceId = null;
        match.slot.qty = 0;
        consumedInstanceIds.add(consumedInstanceId);
        invRt?.itemInstanceById?.delete?.(consumedInstanceId);
      } else {
        match.slot.qty = nextQty;
      }

      const slotKey = `${match.container.id}:${match.slot.slotIndex}`;
      if (!touchedSlots.has(slotKey)) {
        touchedSlots.set(slotKey, {
          containerId: match.container.id,
          slotIndex: match.slot.slotIndex,
          slot: match.slot,
        });
      }
      touchedContainers.add(String(match.container.id));
    }
  }

  if (touchedSlots.size > 0) {
    await flush(
      invRt,
      {
        touchedContainers: Array.from(touchedContainers),
        touchedSlots: Array.from(touchedSlots.values()),
      },
      tx
    );
  }

  for (const id of consumedInstanceIds) {
    await db.GaItemInstance.destroy({
      where: { id: Number(id) },
      transaction: tx,
    });
  }

  return {
    touchedContainers: Array.from(touchedContainers),
    touchedSlots: Array.from(touchedSlots.values()),
    consumedInstanceIds: Array.from(consumedInstanceIds),
  };
}

function hasCapability(rt, capabilityCode) {
  if (!capabilityCode) return false;
  return listUnlockedCapabilities(rt).has(String(capabilityCode));
}

async function persistDirtyResearch(userId, rt = getRuntime(userId), forceAll = false, tx = null) {
  const studies = Array.isArray(rt?.research?.studies) ? rt.research.studies : [];
  const dirtyStudies = studies.filter((study) => forceAll || study.dirty || study.forcePersist);
  if (dirtyStudies.length === 0) return false;

  const now = new Date();
  for (const study of dirtyStudies) {
    await db.GaUserResearch.upsert({
      user_id: Number(userId),
      research_def_id: Number(study.researchDefId),
      current_level: Number(study.currentLevel),
      status: study.status,
      active_level: Number(study.activeLevel),
      progress_ms: Number(Math.floor(study.progressMs)),
      started_at_ms: study.startedAtMs == null ? null : Number(study.startedAtMs),
      completed_at_ms: study.completedAtMs == null ? null : Number(study.completedAtMs),
      updated_at: now,
    }, { transaction: tx });

    study.dirty = false;
    study.forcePersist = false;
    study.lastPersistBucket = Math.floor(toFiniteNumber(study.progressMs, 0) / PROGRESS_PERSIST_STEP_MS);
  }

  return true;
}

async function startResearch(userId, researchCode, nowMs = Date.now()) {
  return withInventoryLock(userId, async () => {
    const rt = getRuntime(userId);
    if (!rt) {
      return { ok: false, code: "RUNTIME_NOT_LOADED", message: "Runtime not loaded" };
    }

    const invRt = await ensureInventoryLoaded(userId);
    const research = await ensureResearchLoaded(userId, rt, { forceReload: true });
    const target = research.studies.find((study) => String(study.code) === String(researchCode));
    if (!target) {
      return { ok: false, code: "RESEARCH_NOT_FOUND", message: "Research not found" };
    }
    if (target.status === STATUS_RUNNING) {
      return { ok: true, research: buildResearchPayload(rt) };
    }
    if (target.currentLevel >= target.maxLevel || target.status === STATUS_COMPLETED) {
      return { ok: false, code: "RESEARCH_ALREADY_COMPLETED", message: "Research already completed" };
    }

    const running = research.studies.find((study) => study.status === STATUS_RUNNING);
    if (running && running.code !== target.code) {
      return { ok: false, code: "RESEARCH_ALREADY_RUNNING", message: "Another research is already running" };
    }

    const nextStudy = resolveCurrentStudy(target.levels, target.activeLevel);
    const tx = await db.sequelize.transaction();
    try {
      await consumeResearchItemCosts(userId, invRt, nextStudy?.requirements ?? null, tx);

      target.status = STATUS_RUNNING;
      target.startedAtMs = nowMs;
      target.dirty = true;
      target.forcePersist = true;
      research.activeResearchCode = target.code;

      for (const study of research.studies) {
        study.canStart = false;
      }

      await persistDirtyResearch(userId, rt, false, tx);
      await tx.commit();

      return {
        ok: true,
        research: buildResearchPayload(rt),
      };
    } catch (error) {
      await tx.rollback().catch(() => {});
      return {
        ok: false,
        code: error?.code || "RESEARCH_START_FAILED",
        message: error?.message || "Failed to start research",
        meta: error?.meta,
      };
    }
  });
}

async function processResearchTick(rt, nowMs = Date.now(), dtMs = 50) {
  if (!rt?.userId) return { changed: false, completed: false };
  const research = await ensureResearchLoaded(rt.userId, rt);
  const active = research.studies.find((study) => study.status === STATUS_RUNNING);
  if (!active) return { changed: false, completed: false };

  const studyDef = resolveCurrentStudy(active.levels, active.activeLevel);
  const targetTimeMs = Math.max(1, toFiniteNumber(studyDef?.studyTimeMs, 1));
  const nextProgress = clamp(toFiniteNumber(active.progressMs, 0) + Math.max(0, dtMs), 0, targetTimeMs);
  if (nextProgress === active.progressMs) {
    return { changed: false, completed: false };
  }

  active.progressMs = nextProgress;
  active.dirty = true;

  let completed = false;
  if (nextProgress >= targetTimeMs) {
    active.currentLevel = Math.min(active.maxLevel, active.activeLevel);
    active.progressMs = 0;
    active.startedAtMs = null;
    active.completedAtMs = nowMs;
    completed = true;

    if (active.currentLevel >= active.maxLevel) {
      active.status = STATUS_COMPLETED;
      active.canStart = false;
    } else {
      active.status = STATUS_IDLE;
      active.activeLevel = Math.min(active.maxLevel, active.currentLevel + 1);
      active.canStart = true;
    }

    research.activeResearchCode = null;
    for (const study of research.studies) {
      study.canStart =
        study.currentLevel < study.maxLevel &&
        study.status !== STATUS_RUNNING;
    }
  }

  const bucket = Math.floor(active.progressMs / PROGRESS_PERSIST_STEP_MS);
  if (completed || bucket !== active.lastPersistBucket) {
    active.forcePersist = true;
    await persistDirtyResearch(rt.userId, rt);
  }

  return { changed: true, completed };
}

module.exports = {
  buildResearchPayload,
  ensureResearchLoaded,
  hasCapability,
  persistDirtyResearch,
  processResearchTick,
  startResearch,
};
