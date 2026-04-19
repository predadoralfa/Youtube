// server/state/persistence/writers.js
const db = require("../../models");
const { getUserStatsSupport } = require("../runtime/statsSchema");

const { getRuntime } = require("../runtimeStore");
const {
  resolveStaminaPersistBucket,
  syncStaminaPersistMarkers,
} = require("../movement/stamina");

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function readRuntimeCombatField(rt, field, fallback = 0) {
  const combat = rt?.combat ?? {};
  const stats = rt?.stats ?? {};
  const vitalsHp = rt?.vitals?.hp ?? {};

  switch (field) {
    case "hpCurrent":
      return toNum(
        vitalsHp.current ??
          combat.hpCurrent ??
          stats.hpCurrent ??
          rt?.hpCurrent ??
          rt?.hp ??
          fallback,
        fallback
      );
    case "hpMax":
      return toNum(
        vitalsHp.max ??
          combat.hpMax ??
          stats.hpMax ??
          rt?.hpMax ??
          fallback,
        fallback
      );
    case "staminaCurrent":
      return toNum(
        rt?.vitals?.stamina?.current ??
          combat.staminaCurrent ??
          stats.staminaCurrent ??
          rt?.staminaCurrent ??
          fallback,
        fallback
      );
    case "staminaMax":
      return toNum(
        rt?.vitals?.stamina?.max ??
          combat.staminaMax ??
          stats.staminaMax ??
          rt?.staminaMax ??
          fallback,
        fallback
      );
    case "hungerCurrent":
      return toNum(
        rt?.vitals?.hunger?.current ??
          combat.hungerCurrent ??
          stats.hungerCurrent ??
          rt?.hungerCurrent ??
          fallback,
        fallback
      );
    case "hungerMax":
      return toNum(
        rt?.vitals?.hunger?.max ??
          combat.hungerMax ??
          stats.hungerMax ??
          rt?.hungerMax ??
          fallback,
        fallback
      );
    case "thirstCurrent":
      return toNum(
        rt?.vitals?.thirst?.current ??
          combat.thirstCurrent ??
          stats.thirstCurrent ??
          rt?.thirstCurrent ??
          fallback,
        fallback
      );
    case "thirstMax":
      return toNum(
        rt?.vitals?.thirst?.max ??
          combat.thirstMax ??
          stats.thirstMax ??
          rt?.thirstMax ??
          fallback,
        fallback
      );
    case "attackPower":
      return toNum(
        combat.attackPower ?? stats.attackPower ?? rt?.attackPower ?? fallback,
        fallback
      );
    case "defense":
      return toNum(combat.defense ?? stats.defense ?? rt?.defense ?? fallback, fallback);
    case "attackSpeed":
      return toNum(
        combat.attackSpeed ?? stats.attackSpeed ?? rt?.attackSpeed ?? fallback,
        fallback
      );
    case "attackRange":
      return toNum(
        combat.attackRange ?? stats.attackRange ?? rt?.attackRange ?? fallback,
        fallback
      );
    case "moveSpeed":
      return toNum(rt?.speed ?? stats.moveSpeed ?? fallback, fallback);
    default:
      return fallback;
  }
}

/**
 * Flush do runtime (pos/yaw/instance + connection fields)
 * - UPDATE por PK user_id
 */
async function flushUserRuntime(userId, now) {
  const rt = getRuntime(userId);
  if (!rt) return false;

  // Só escreve se ainda está dirty
  if (!rt.dirtyRuntime) return false;

  try {
    const payload = {
      instance_id: rt.instanceId,
      pos_x: rt.pos?.x ?? 0,
      pos_y: rt.pos?.y ?? 0,
      pos_z: rt.pos?.z ?? 0,
      yaw: rt.yaw ?? 0,
      camera_pitch: rt.cameraPitch ?? Math.PI / 4,
      camera_distance: rt.cameraDistance ?? 26,

      connection_state: rt.connectionState ?? "OFFLINE",
      disconnected_at: rt.disconnectedAtMs ?? null,
      offline_allowed_at: rt.offlineAllowedAtMs ?? null,
    };

    await db.GaUserRuntime.update(payload, {
      where: { user_id: rt.userId },
    });

    rt.dirtyRuntime = false;

    // log só em eventos relevantes
    if (rt.connectionState !== "CONNECTED") {
      console.log(
        `[PERSIST] flushed runtime user=${rt.userId} state=${rt.connectionState}`
      );
    }

    return true;
  } catch (err) {
    console.error(`[PERSIST] flushUserRuntime failed user=${rt?.userId}`, err);
    return false;
  }
}

/**
 * Flush dos stats de combate/sobrevivência.
 * Hoje persistimos HP/stamina e os atributos de combate do runtime.
 */
async function flushUserStats(userId, now, { force = false } = {}) {
  const rt = getRuntime(userId);
  if (!rt) return false;
  if (!force && !rt.dirtyStats) return false;

  try {
    const support = await getUserStatsSupport();
    const staminaCurrentRaw = readRuntimeCombatField(rt, "staminaCurrent", 100);
    const staminaMax = readRuntimeCombatField(rt, "staminaMax", 100);
    const staminaBucket = resolveStaminaPersistBucket(staminaCurrentRaw, staminaMax);
    const staminaCurrent = Math.max(
      0,
      Math.min(staminaMax, Math.round(staminaCurrentRaw))
    );

    const payload = {
      hp_current: readRuntimeCombatField(rt, "hpCurrent", 100),
      hp_max: readRuntimeCombatField(rt, "hpMax", 100),
      stamina_current: staminaCurrent,
      stamina_max: staminaMax,
      hunger_current: readRuntimeCombatField(rt, "hungerCurrent", 100),
      hunger_max: readRuntimeCombatField(rt, "hungerMax", 100),
      attack_power: readRuntimeCombatField(rt, "attackPower", 10),
      defense: readRuntimeCombatField(rt, "defense", 0),
      attack_speed: readRuntimeCombatField(rt, "attackSpeed", 1),
      attack_range: readRuntimeCombatField(rt, "attackRange", 1.2),
      move_speed: readRuntimeCombatField(rt, "moveSpeed", 5),
    };

    if (support.supportsThirst) {
      payload.thirst_current = readRuntimeCombatField(rt, "thirstCurrent", 100);
      payload.thirst_max = readRuntimeCombatField(rt, "thirstMax", 100);
    }

    await db.GaUserStats.update(payload, {
      where: { user_id: rt.userId },
    });

    syncStaminaPersistMarkers(rt, staminaBucket);
    rt.dirtyStats = false;
    return true;
  } catch (err) {
    console.error(`[PERSIST] flushUserStats failed user=${rt?.userId}`, err);
    return false;
  }
}

module.exports = {
  flushUserRuntime,
  flushUserStats,
};
