"use strict";

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function resolveDropVisualHint(itemDef, effectiveItemInstance) {
  const code = String(itemDef?.code ?? effectiveItemInstance?.code ?? "").trim().toUpperCase();
  const name = String(itemDef?.name ?? effectiveItemInstance?.name ?? "").trim().toUpperCase();
  const token = `${code} ${name}`;

  if (token.includes("APPLE") || token.includes("MACA")) return "APPLE";
  if (token.includes("STONE") || token.includes("ROCK") || token.includes("PEDRA")) return "ROCK";
  return "DEFAULT";
}

module.exports = {
  toNum,
  resolveDropVisualHint,
};
