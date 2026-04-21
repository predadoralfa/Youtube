"use strict";

const { CONNECTION } = require("../constants");
const { resolveTerrainHeightFromBounds } = require("../../movement/terrain");

function createBaseRuntime({
  row,
  bounds,
  speed,
  combatStats,
  autoFood,
  nowMs,
}) {
  const terrainY = resolveTerrainHeightFromBounds(bounds, row.pos_x ?? 0, row.pos_z ?? 0);

  return {
    userId: row.user_id,
    instanceId: row.instance_id,
    pos: {
      x: Number(row.pos_x ?? 0),
      y: terrainY,
      z: Number(row.pos_z ?? 0),
    },
    yaw: Number(row.yaw ?? 0),
    cameraPitch: Number(row.camera_pitch ?? Math.PI / 4),
    cameraDistance: Number(row.camera_distance ?? 26),

    hp: combatStats?.hpCurrent,
    hpCurrent: combatStats?.hpCurrent,
    hpMax: combatStats?.hpMax,
    staminaCurrent: combatStats?.staminaCurrent,
    staminaMax: combatStats?.staminaMax,
    hungerCurrent: combatStats?.hungerCurrent,
    hungerMax: combatStats?.hungerMax,
    thirstCurrent: combatStats?.thirstCurrent,
    thirstMax: combatStats?.thirstMax,
    thirstSupported: Boolean(combatStats?.thirstSupported),
    action: "idle",
    rev: 0,
    chunk: null,

    speed,
    _speedFallback: false,
    staminaTickAtMs: nowMs,
    hungerTickAtMs: nowMs,
    thirstTickAtMs: nowMs,

    connectionState: row.connection_state || CONNECTION.OFFLINE,
    disconnectedAtMs: row.disconnected_at == null ? null : Number(row.disconnected_at),
    offlineAllowedAtMs: row.offline_allowed_at == null ? null : Number(row.offline_allowed_at),

    dirtyRuntime: false,
    dirtyStats: Boolean(combatStats?.hungerWasAdjusted || combatStats?.thirstWasAdjusted),
    lastRuntimeDirtyAtMs: 0,
    lastStatsDirtyAtMs: 0,

    lastMoveAtMs: 0,
    moveCountWindow: 0,
    moveWindowStartMs: 0,

    bounds,
    autoFood,

    moveTickAtMs: 0,
    lastClickAtMs: 0,
    movementInput: {
      mode: "STOP",
      dir: { x: 0, z: 0 },
      target: null,
      stopRadius: 0.75,
      seq: 0,
      updatedAtMs: 0,
      yaw: Number(row.yaw ?? 0),
      cameraPitch: Number(row.camera_pitch ?? Math.PI / 4),
      cameraDistance: Number(row.camera_distance ?? 26),
    },

    combat: {
      hpCurrent: combatStats?.hpCurrent,
      hpMax: combatStats?.hpMax,
      staminaCurrent: combatStats?.staminaCurrent,
      staminaMax: combatStats?.staminaMax,
      hungerCurrent: combatStats?.hungerCurrent,
      hungerMax: combatStats?.hungerMax,
      thirstCurrent: combatStats?.thirstCurrent,
      thirstMax: combatStats?.thirstMax,
      thirstSupported: Boolean(combatStats?.thirstSupported),
      attackPower: combatStats?.attackPower,
      defense: combatStats?.defense,
      attackSpeed: combatStats?.attackSpeed,
      attackRange: combatStats?.attackRange,
      lastAttackAtMs: 0,
      targetId: null,
      targetKind: null,
      state: "IDLE",
    },

    stats: {
      hpCurrent: combatStats?.hpCurrent,
      hpMax: combatStats?.hpMax,
      staminaCurrent: combatStats?.staminaCurrent,
      staminaMax: combatStats?.staminaMax,
      thirstCurrent: combatStats?.thirstCurrent,
      thirstMax: combatStats?.thirstMax,
      thirstSupported: Boolean(combatStats?.thirstSupported),
      attackPower: combatStats?.attackPower,
      defense: combatStats?.defense,
      attackSpeed: combatStats?.attackSpeed,
      attackRange: combatStats?.attackRange,
    },
  };
}

module.exports = {
  createBaseRuntime,
};
