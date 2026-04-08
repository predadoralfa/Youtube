"use strict";

const db = require("../../models");
const { getRuntime } = require("../../state/runtime/store");
const { PROGRESS_PERSIST_STEP_MS, toFiniteNumber } = require("./shared");

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

module.exports = {
  persistDirtyResearch,
};
