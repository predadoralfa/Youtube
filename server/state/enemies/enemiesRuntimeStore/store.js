"use strict";

const enemiesById = new Map();
const enemiesByInstance = new Map();

function toKey(v) {
  return String(v);
}

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function ensureInstanceSet(instanceId) {
  const key = toKey(instanceId);
  let set = enemiesByInstance.get(key);
  if (!set) {
    set = new Set();
    enemiesByInstance.set(key, set);
  }
  return set;
}

module.exports = {
  enemiesById,
  enemiesByInstance,
  toKey,
  toNum,
  ensureInstanceSet,
};
