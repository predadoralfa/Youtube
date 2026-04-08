"use strict";

const {
  STATUS_RUNNING,
  STATUS_COMPLETED,
  clamp,
  normalizeItemCosts,
  normalizeUnlocks,
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

function hasCapability(rt, capabilityCode) {
  if (!capabilityCode) return false;
  return listUnlockedCapabilities(rt).has(String(capabilityCode));
}

module.exports = {
  buildResearchPayload,
  hasCapability,
};
