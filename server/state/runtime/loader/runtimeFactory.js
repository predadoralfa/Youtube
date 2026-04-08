"use strict";

const { CONNECTION } = require("../constants");

function createBaseRuntime({
  row,
  bounds,
  speed,
  combatStats,
  autoFood,
  nowMs,
}) {
  return {
    userId: row.user_id,
    instanceId: row.instance_id,
    pos: {
      x: Number(row.pos_x ?? 0),
      y: Number(row.pos_y ?? 0),
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
    action: "idle",
    rev: 0,
    chunk: null,

    speed,
    _speedFallback: false,
    staminaTickAtMs: nowMs,
    hungerTickAtMs: nowMs,

    connectionState: row.connection_state || CONNECTION.OFFLINE,
    disconnectedAtMs: row.disconnected_at == null ? null : Number(row.disconnected_at),
    offlineAllowedAtMs: row.offline_allowed_at == null ? null : Number(row.offline_allowed_at),

    dirtyRuntime: false,
    dirtyStats: Boolean(combatStats?.hungerWasAdjusted),
    lastRuntimeDirtyAtMs: 0,
    lastStatsDirtyAtMs: 0,

    lastMoveAtMs: 0,
    moveCountWindow: 0,
    moveWindowStartMs: 0,

    bounds,
    autoFood,

    moveMode: "STOP",
    moveTarget: null,
    moveStopRadius: 0.75,
    moveTickAtMs: 0,
    wasdTickAtMs: 0,
    inputDir: { x: 0, z: 0 },
    inputDirAtMs: 0,
    lastClickAtMs: 0,

    combat: {
      hpCurrent: combatStats?.hpCurrent,
      hpMax: combatStats?.hpMax,
      staminaCurrent: combatStats?.staminaCurrent,
      staminaMax: combatStats?.staminaMax,
      hungerCurrent: combatStats?.hungerCurrent,
      hungerMax: combatStats?.hungerMax,
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
