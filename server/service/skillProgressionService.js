"use strict";

const db = require("../models");
const { getRuntime } = require("../state/runtimeStore");
const { resolveSleepXpMultiplierBasisPoints } = require("../state/movement/status");

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBigInt(value, fallback = 0n) {
  if (typeof value === "bigint") return value;
  if (value == null || value === "") return fallback;

  try {
    return BigInt(String(value));
  } catch {
    return fallback;
  }
}

function requiredXpForLevel(level) {
  const safeLevel = Math.max(1, toNumber(level, 1));
  const exponent = BigInt(safeLevel - 1);
  const numerator = 100n * (3n ** exponent);
  const denominator = 2n ** exponent;
  return (numerator + denominator - 1n) / denominator;
}

async function loadSkillDef(skillCode, tx) {
  return db.GaSkillDef.findOne({
    where: {
      code: skillCode,
      is_active: true,
    },
    include: [
      {
        model: db.GaSkillLevelDef,
        as: "levels",
        required: false,
      },
    ],
    transaction: tx,
  });
}

async function loadUserSkillSummary(userId, skillCode, tx) {
  const skillDef = await loadSkillDef(skillCode, tx);
  if (!skillDef) return null;

  const userSkill = await db.GaUserSkill.findOne({
    where: {
      user_id: Number(userId),
      skill_def_id: Number(skillDef.id),
    },
    transaction: tx,
  });

  const requiredXpByLevel = buildRequiredXpByLevel(skillDef);
  const currentLevel = Math.max(1, toNumber(userSkill?.current_level, 1));
  const currentXp = toBigInt(userSkill?.current_xp, 0n);
  const totalXp = toBigInt(userSkill?.total_xp, 0n);
  const requiredXp = requiredXpByLevel.get(currentLevel) ?? requiredXpForLevel(currentLevel);

  return {
    skillDefId: Number(skillDef.id),
    skillCode,
    skillName: skillDef.name,
    currentLevel,
    currentXp: currentXp.toString(),
    totalXp: totalXp.toString(),
    requiredXp: requiredXp == null ? null : requiredXp.toString(),
    maxLevel: Math.max(1, toNumber(skillDef.max_level ?? skillDef.maxLevel, 1)),
  };
}

async function loadUserSkillSummaries(userId, skillCodes, tx) {
  const codes = Array.isArray(skillCodes) ? skillCodes : [];
  const summaries = {};

  for (const skillCode of codes) {
    const summary = await loadUserSkillSummary(userId, skillCode, tx);
    if (summary) {
      summaries[skillCode] = summary;
    }
  }

  return summaries;
}

async function loadUserSkillSummaryByCode(userId, skillCode, tx) {
  return loadUserSkillSummary(userId, skillCode, tx);
}

function buildRequiredXpByLevel(skillDef) {
  const rows = Array.isArray(skillDef?.levels) ? skillDef.levels : [];
  return new Map(
    rows.map((row) => [
      Number(row.level),
      toBigInt(row.required_xp ?? row.requiredXp, 0n),
    ])
  );
}

// Central path for XP modifiers. Any XP award should pass through here so sleep
// is applied consistently across the server.
function resolveXpModifiers(userId, xpAmount) {
  const runtime = getRuntime(userId);
  const sleepCurrent =
    runtime?.status?.sleep?.current ??
    runtime?.sleepCurrent ??
    runtime?.stats?.sleepCurrent ??
    100;
  const sleepMax =
    runtime?.status?.sleep?.max ??
    runtime?.sleepMax ??
    runtime?.stats?.sleepMax ??
    100;
  const multiplierBps = resolveSleepXpMultiplierBasisPoints(sleepCurrent, sleepMax);
  const baseXp = toBigInt(xpAmount, 0n);
  if (baseXp <= 0n) return { xp: 0n, multiplierBps };
  const adjustedXp = (baseXp * BigInt(multiplierBps) + 5000n) / 10000n;
  return {
    xp: adjustedXp,
    multiplierBps,
  };
}

async function ensureUserSkill(userId, skillDefId, tx) {
  const [row] = await db.GaUserSkill.findOrCreate({
    where: {
      user_id: Number(userId),
      skill_def_id: Number(skillDefId),
    },
    defaults: {
      current_level: 1,
      current_xp: 0,
      total_xp: 0,
    },
    transaction: tx,
  });

  if (toNumber(row.current_level, 0) <= 0) {
    row.current_level = 1;
  }

  return row;
}

async function awardSkillXp(userId, skillCode, xpAmount, tx) {
  const sleepAdjusted = resolveXpModifiers(userId, xpAmount);
  const xp = sleepAdjusted.xp;
  if (xp <= 0n) return null;

  const skillDef = await loadSkillDef(skillCode, tx);
  if (!skillDef) return null;

  const userSkill = await ensureUserSkill(userId, skillDef.id, tx);
  const requiredXpByLevel = buildRequiredXpByLevel(skillDef);
  const maxLevel = Math.max(1, toNumber(skillDef.max_level ?? skillDef.maxLevel, 1));

  let currentLevel = Math.max(1, toNumber(userSkill.current_level, 1));
  let currentXp = toBigInt(userSkill.current_xp, 0n) + xp;
  const totalXp = toBigInt(userSkill.total_xp, 0n) + xp;
  const levelBefore = currentLevel;

  while (currentLevel < maxLevel) {
    const requiredXp = requiredXpByLevel.get(currentLevel) ?? requiredXpForLevel(currentLevel);
    if (requiredXp == null || requiredXp <= 0n || currentXp < requiredXp) break;
    currentXp -= requiredXp;
    currentLevel += 1;
  }

  if (currentLevel >= maxLevel) {
    currentLevel = maxLevel;
    const maxRequired = requiredXpByLevel.get(currentLevel) ?? requiredXpForLevel(currentLevel);
    if (maxRequired != null && maxRequired > 0n) {
      currentXp = currentXp > maxRequired ? maxRequired : currentXp;
    }
  }

  await userSkill.update(
    {
      current_level: currentLevel,
      current_xp: currentXp.toString(),
      total_xp: totalXp.toString(),
    },
    { transaction: tx }
  );

  const requiredXp = requiredXpByLevel.get(currentLevel) ?? requiredXpForLevel(currentLevel);

  return {
    skillCode,
    skillName: skillDef.name,
    xpGained: xp.toString(),
    sleepMultiplierBps: sleepAdjusted.multiplierBps,
    levelBefore,
    level: currentLevel,
    leveledUp: currentLevel > levelBefore,
    currentXp: currentXp.toString(),
    requiredXp: requiredXp == null ? null : requiredXp.toString(),
    totalXp: totalXp.toString(),
  };
}

module.exports = {
  awardSkillXp,
  resolveXpModifiers,
  loadUserSkillSummary,
  loadUserSkillSummaryByCode,
  loadUserSkillSummaries,
};
