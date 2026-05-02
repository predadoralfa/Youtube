"use strict";

const STATUS_IDLE = "IDLE";
const STATUS_RUNNING = "RUNNING";
const STATUS_COMPLETED = "COMPLETED";
const PROGRESS_PERSIST_STEP_MS = 1000;

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

function normalizeResearchRequirements(value) {
  return (Array.isArray(value?.researchRequirements) ? value.researchRequirements : [])
    .map((entry) => {
      const researchCode = entry?.researchCode != null ? String(entry.researchCode).trim() : null;
      const researchDefId = entry?.researchDefId != null ? Math.floor(toFiniteNumber(entry.researchDefId, 0)) : null;
      const level = Math.max(1, Math.floor(toFiniteNumber(entry?.level, 1)));

      return {
        researchCode: researchCode || null,
        researchDefId: Number.isFinite(researchDefId) && researchDefId > 0 ? researchDefId : null,
        level,
      };
    })
    .filter((entry) => (entry.researchCode || entry.researchDefId) && entry.level > 0);
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
  return levels.find((level) => Number(level.level) === Number(activeLevel)) ?? null;
}

module.exports = {
  STATUS_IDLE,
  STATUS_RUNNING,
  STATUS_COMPLETED,
  PROGRESS_PERSIST_STEP_MS,
  toFiniteNumber,
  clamp,
  parseJsonObject,
  normalizeUnlocks,
  normalizeItemCosts,
  normalizeResearchRequirements,
  normalizeItemCode,
  canonicalResearchItemCode,
  resolveCurrentStudy,
};
