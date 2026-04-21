"use strict";

const db = require("../../models");
const { getRuntime } = require("../../state/runtime/store");
const { withInventoryLock } = require("../../state/inventory/store");
const { ensureResearchLoaded } = require("./definitions");
const { buildResearchPayload } = require("./payload");
const { consumeResearchItemCosts } = require("./costs");
const { persistDirtyResearch } = require("./persistence");
const { resolveFeverDebuffTempoMultiplier } = require("../../state/conditions/fever");
const {
  STATUS_RUNNING,
  STATUS_COMPLETED,
  STATUS_IDLE,
  PROGRESS_PERSIST_STEP_MS,
  clamp,
  resolveCurrentStudy,
  toFiniteNumber,
} = require("./shared");

async function startResearch(userId, researchCode, nowMs = Date.now()) {
  return withInventoryLock(userId, async () => {
    const { ensureInventoryLoaded } = require("../../state/inventory/loader");
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
    if (target.isVisible === false) {
      return { ok: false, code: "RESEARCH_LOCKED", message: "Research is locked" };
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
  const feverTempoMultiplier = resolveFeverDebuffTempoMultiplier(
    rt?.status?.fever?.current ?? rt?.diseaseLevel ?? rt?.stats?.diseaseLevel ?? 0,
    rt?.status?.fever?.severity ?? rt?.diseaseSeverity ?? rt?.stats?.diseaseSeverity ?? 0
  );
  const effectiveDtMs = Math.max(0, dtMs) / Math.max(1, feverTempoMultiplier);
  const nextProgress = clamp(toFiniteNumber(active.progressMs, 0) + effectiveDtMs, 0, targetTimeMs);
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
  startResearch,
  processResearchTick,
};
