"use strict";

const {
  STATUS_RUNNING,
  STATUS_COMPLETED,
  clamp,
  canonicalResearchItemCode,
  normalizeItemCosts,
  normalizeUnlocks,
  normalizeItemCode,
  resolveCurrentStudy,
  toFiniteNumber,
} = require("./shared");

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
    isVisible: study.isVisible !== false,
    prerequisiteResearchDefId: study.prerequisiteResearchDefId ?? null,
    prerequisiteResearchCode: study.prerequisiteResearchCode ?? null,
    prerequisiteResearchName: study.prerequisiteResearchName ?? null,
    prerequisiteLevel: Number(study.prerequisiteLevel ?? 1),
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
    unlockedCapabilities: Array.from(listUnlockedCapabilities(rt)).sort(),
    studies: studies.map(buildStudyPayload),
  };
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

function resolveResearchModifierDelta(rt, prefix, targetCode) {
  const normalizedPrefix = String(prefix ?? "").trim();
  const normalizedTarget = normalizeItemCode(canonicalResearchItemCode(targetCode));
  if (!normalizedPrefix || !normalizedTarget) return 0;

  let total = 0;
  for (const unlockCode of listUnlockedCapabilities(rt)) {
    const raw = String(unlockCode ?? "").trim();
    if (!raw.startsWith(`${normalizedPrefix}:`)) continue;

    const parts = raw.split(":");
    if (parts.length < 3) continue;

    const unlockTarget = normalizeItemCode(parts[1]);
    if (unlockTarget !== normalizedTarget) continue;

    const deltaText = parts.slice(2).join(":");
    const delta = Number(deltaText);
    if (Number.isFinite(delta)) {
      total += delta;
    }
  }

  return total;
}

function resolveResearchItemWeightDelta(rt, itemCode) {
  return resolveResearchModifierDelta(rt, "item.weight_delta", itemCode);
}

function canonicalResearchContainerCode(value) {
  const normalized = normalizeItemCode(value);
  if (normalized.startsWith("BASKET")) {
    return "BASKET";
  }
  return normalized;
}

function resolveResearchContainerMaxWeightDelta(rt, containerCode) {
  return resolveResearchModifierDelta(
    rt,
    "container.max_weight_delta",
    canonicalResearchContainerCode(containerCode)
  );
}

function resolveResearchItemCollectTimeDelta(rt, itemCode) {
  return resolveResearchModifierDelta(rt, "item.collect_time_delta", itemCode);
}

function hasCapability(rt, capabilityCode) {
  if (!capabilityCode) return false;
  return listUnlockedCapabilities(rt).has(String(capabilityCode));
}

module.exports = {
  buildResearchPayload,
  hasCapability,
  listUnlockedCapabilities,
  resolveResearchModifierDelta,
  resolveResearchItemWeightDelta,
  resolveResearchContainerMaxWeightDelta,
  resolveResearchItemCollectTimeDelta,
};
