"use strict";

const db = require("../../models");
const { getRuntime } = require("../../state/runtime/store");
const {
  STATUS_IDLE,
  STATUS_RUNNING,
  STATUS_COMPLETED,
  PROGRESS_PERSIST_STEP_MS,
  clamp,
  normalizeItemCosts,
  normalizeResearchRequirements,
  parseJsonObject,
  resolveCurrentStudy,
  toFiniteNumber,
} = require("./shared");

let cachedResearchLevelColumns = null;

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
        include: [
          {
            model: db.GaItemDefComponent,
            as: "components",
            required: false,
            attributes: ["id", "component_type"],
          },
        ],
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
  const defById = new Map(defs.map((def) => [Number(def.id), def]));
  const defByCode = new Map(defs.map((def) => [String(def.code), def]));
  const userByDefId = new Map(userRows.map((row) => [Number(row.research_def_id), row]));

  const studies = defs.map((def) => {
    const row = userByDefId.get(Number(def.id));
    const prerequisiteResearchDefId = toFiniteNumber(def.prerequisite_research_def_id ?? def.prerequisiteResearchDefId, 0) || null;
    const prerequisiteDef = prerequisiteResearchDefId ? defById.get(Number(prerequisiteResearchDefId)) ?? null : null;
    const prerequisiteLevelRaw = Math.max(1, Math.floor(toFiniteNumber(def.prerequisite_level ?? def.prerequisiteLevel, 1)));
    const prerequisiteLevel = prerequisiteDef
      ? clamp(prerequisiteLevelRaw, 1, Math.max(1, Number(prerequisiteDef.max_level ?? prerequisiteLevelRaw)))
      : prerequisiteLevelRaw;
    const prerequisiteRow = prerequisiteDef ? userByDefId.get(Number(prerequisiteDef.id)) ?? null : null;
    const prerequisiteCurrentLevel = prerequisiteDef
      ? clamp(
          toFiniteNumber(prerequisiteRow?.current_level, 0),
          0,
          Math.max(0, Number(prerequisiteDef.max_level ?? 1))
        )
      : 0;
    const prerequisiteSatisfied = !prerequisiteResearchDefId
      ? true
      : Boolean(prerequisiteDef) && prerequisiteCurrentLevel >= prerequisiteLevel;
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
    const levelResearchRequirements = normalizeResearchRequirements(nextStudy?.requirements).map((requirement) => {
      const requiredDef =
        (requirement.researchDefId ? defById.get(Number(requirement.researchDefId)) ?? null : null) ??
        (requirement.researchCode ? defByCode.get(String(requirement.researchCode)) ?? null : null);
      const requiredCurrentLevel = requiredDef
        ? clamp(
            toFiniteNumber(userByDefId.get(Number(requiredDef.id))?.current_level, 0),
            0,
            Math.max(0, Number(requiredDef.max_level ?? 1))
          )
        : 0;
      return {
        researchDefId: requiredDef ? Number(requiredDef.id) : requirement.researchDefId ?? null,
        researchCode: requiredDef?.code ?? requirement.researchCode ?? null,
        researchName: requiredDef?.name ?? null,
        level: Number(requirement.level ?? 1),
        satisfied: Boolean(requiredDef) && requiredCurrentLevel >= Number(requirement.level ?? 1),
      };
    });
    const levelResearchRequirementsSatisfied = levelResearchRequirements.every((requirement) => requirement.satisfied !== false);
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
      levelResearchRequirements,
      levelResearchRequirementsSatisfied,
      levels,
      itemDef: def.itemDef
        ? {
            id: Number(def.itemDef.id),
            code: def.itemDef.code,
            name: def.itemDef.name,
            assetKey: def.itemDef.assetKey ?? def.itemDef.asset_key ?? null,
            category: def.itemDef.category,
          }
        : null,
      prerequisiteResearchDefId,
      prerequisiteResearchCode: prerequisiteDef?.code ?? null,
      prerequisiteResearchName: prerequisiteDef?.name ?? null,
      prerequisiteLevel,
      isVisible: true,
      prerequisiteSatisfied,
      dirty: false,
      forcePersist: false,
      lastPersistBucket: Math.floor(progressMs / PROGRESS_PERSIST_STEP_MS),
      canStart: currentLevel < maxLevel && levelResearchRequirementsSatisfied,
    };
  });

  const running = studies.find((study) => study.status === STATUS_RUNNING) ?? null;
  for (const study of studies) {
    study.canStart =
      study.currentLevel < study.maxLevel &&
      study.status !== STATUS_RUNNING &&
      study.prerequisiteSatisfied !== false &&
      study.levelResearchRequirementsSatisfied !== false &&
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

module.exports = {
  ensureResearchLoaded,
};
