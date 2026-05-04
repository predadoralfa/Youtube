"use strict";

function parseMaybeJsonObject(value) {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mergeStateParts(...parts) {
  return parts.reduce((acc, part) => {
    const value = parseMaybeJsonObject(part);
    if (!value || typeof value !== "object" || Array.isArray(value)) return acc;
    return { ...acc, ...value };
  }, {});
}

module.exports = {
  parseMaybeJsonObject,
  toFiniteNumber,
  mergeStateParts,
};
