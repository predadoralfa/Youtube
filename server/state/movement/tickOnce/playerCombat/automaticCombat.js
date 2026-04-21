"use strict";

const { COMBAT_BASE_COOLDOWN_MS } = require("../../../../config/combatConstants");
const { getEnemy } = require("../../../enemies/enemiesRuntimeStore");
const { loadPlayerCombatStats } = require("../../../runtime/combatLoader");
const { executeServerSideAttack } = require("./executeServerSideAttack");
const { resolveFeverDebuffTempoMultiplier } = require("../../../conditions/fever");
const { applyClickInput } = require("../../input");

async function processAutomaticCombat(io, rt, nowMs) {
  if (!rt.combat || rt.combat.state !== "ENGAGED") {
    return;
  }

  const targetId = rt.combat.targetId;
  const targetKind = rt.combat.targetKind;
  if (!targetId || targetKind !== "ENEMY") {
    return;
  }

  const cleanEnemyId = String(targetId).replace(/^enemy_/, "");
  const enemy = getEnemy(cleanEnemyId);

  if (!enemy || String(enemy.status) !== "ALIVE") {
    rt.combat.state = "IDLE";
    rt.combat.targetId = null;
    rt.combat.targetKind = null;
    return;
  }

  const playerPos = rt.pos;
  const enemyPos = enemy.pos;
  const dx = enemyPos.x - playerPos.x;
  const dz = enemyPos.z - playerPos.z;
  const distance = Math.sqrt(dx * dx + dz * dz);

  const attackRange = Number(rt.combat?.attackRange ?? 1.2);
  const approachStopRadius = 0.1;

  if (distance <= attackRange) {
    let stats;
    try {
      stats = await loadPlayerCombatStats(rt.userId);
    } catch (err) {
      console.error(`[COMBAT] Invalid player combat stats for user=${rt.userId}:`, err.message);
      return;
    }

    const attackSpeed = Number(stats?.attackSpeed ?? rt.combat?.attackSpeed ?? 1) || 1;
    const lastAttackMs = Number(rt.combat?.lastAttackAtMs ?? 0);
    const feverTempoMultiplier = resolveFeverDebuffTempoMultiplier(
    rt?.status?.fever?.current ?? rt?.diseaseLevel ?? rt?.stats?.diseaseLevel ?? 0,
      rt?.status?.fever?.severity ?? rt?.diseaseSeverity ?? rt?.stats?.diseaseSeverity ?? 0
    );
    const cooldownMs = (COMBAT_BASE_COOLDOWN_MS / attackSpeed) * feverTempoMultiplier;
    const elapsedMs = Number(nowMs ?? Date.now()) - lastAttackMs;
    if (elapsedMs < cooldownMs) {
      return;
    }

    await executeServerSideAttack(io, rt, enemy);
    return;
  }

  try {
    await loadPlayerCombatStats(rt.userId);
  } catch (err) {
    console.error(`[COMBAT] Invalid player combat stats for user=${rt.userId}:`, err.message);
    return;
  }

  applyClickInput(rt, {
    nowMs,
    target: { x: enemyPos.x, z: enemyPos.z },
    stopRadius: approachStopRadius,
  });
  rt.action = "move";
}

module.exports = {
  processAutomaticCombat,
};
