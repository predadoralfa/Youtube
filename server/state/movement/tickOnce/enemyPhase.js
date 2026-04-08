"use strict";

const { tickEnemyMovement } = require("../../enemies/enemyMovement");
const { emitEnemyDelta } = require("../../enemies/enemyEmit");
const { getEnemiesForInstance } = require("../../enemies/enemiesRuntimeStore");
const { tickEnemyAI, getLastTickAttacks } = require("../../enemies/enemyAI");

async function processEnemyPhase(io, allRuntimes, t, processAutomaticCombat) {
  const uniqueInstanceIds = new Set();

  for (const rt of allRuntimes) {
    if (rt?.instanceId) {
      uniqueInstanceIds.add(rt.instanceId);
    }
  }

  for (const instanceId of uniqueInstanceIds) {
    const dt = 0.05;
    const changedEnemies = tickEnemyMovement(instanceId, t, dt);
    for (const enemy of changedEnemies) {
      emitEnemyDelta(io, enemy);
    }

    const enemies = getEnemiesForInstance(instanceId);
    const aiChangedEnemies = await tickEnemyAI(enemies, t, dt);
    for (const enemy of aiChangedEnemies) {
      emitEnemyDelta(io, enemy);
    }

    for (const rt of allRuntimes) {
      if (!rt || String(rt.instanceId) !== String(instanceId)) continue;
      await processAutomaticCombat(io, rt, t);
    }

    const attacks = getLastTickAttacks(enemies);
    if (attacks && Array.isArray(attacks) && attacks.length > 0) {
      for (const attack of attacks) {
        const enemyEventId = `ENEMY:${attack.enemyId}:PLAYER:${attack.targetId}:${t}`;
        io.to(`inst:${instanceId}`).emit("combat:enemy_attack", {
          eventId: enemyEventId,
          enemyId: `enemy_${attack.enemyId}`,
          targetId: attack.targetId,
          targetKind: "PLAYER",
          attackPower: attack.attackPower,
          damage: attack.damage,
          targetHPBefore: attack.targetHPBefore,
          targetHPAfter: attack.targetHPAfter,
          targetHPMax: attack.targetHPMax,
          targetDied: attack.targetDied,
          timestamp: t,
        });
      }
    }

    for (const enemy of enemies) {
      if (enemy.status === "DEAD") {
        io.to(`inst:${instanceId}`).emit("entity:despawn", {
          entityId: `enemy_${enemy.id}`,
        });
      }
    }

    for (const enemy of enemies) {
      if (enemy.status === "ALIVE" && enemy._hpChanged) {
        emitEnemyDelta(io, enemy);
        enemy._hpChanged = false;
      }
    }
  }
}

module.exports = {
  processEnemyPhase,
};
