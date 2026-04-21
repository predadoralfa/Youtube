import * as THREE from "three";

const ENEMY_COLORS = {
  DEFAULT: 0xff6b35,
};

export function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function toDisplayInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

export function getEnemyColor() {
  return ENEMY_COLORS.DEFAULT;
}

export function normalize2D(x, z) {
  const len = Math.hypot(x, z);
  if (len <= 0.00001) return { x: 0, z: 0 };
  return { x: x / len, z: z / len };
}

export function toWorldDir(inputDir, camYaw) {
  const fx = -Math.sin(camYaw);
  const fz = -Math.cos(camYaw);
  const rx = fz;
  const rz = -fx;
  const forwardAmount = -(inputDir.z || 0);
  const strafeAmount = inputDir.x || 0;
  const wx = rx * strafeAmount + fx * forwardAmount;
  const wz = rz * strafeAmount + fz * forwardAmount;
  return normalize2D(wx, wz);
}

export function readPosYawFromRuntime(rt) {
  if (!rt) return { x: 0, y: 0, z: 0, yaw: 0 };

  return {
    x: Number(rt.pos_x ?? rt.pos?.x ?? 0),
    y: Number(rt.pos_y ?? rt.pos?.y ?? 0),
    z: Number(rt.pos_z ?? rt.pos?.z ?? 0),
    yaw: Number(rt.yaw ?? 0),
  };
}

export function readCameraStateFromRuntime(rt) {
  return {
    yaw: Number(rt?.yaw ?? 0),
    pitch: Number(rt?.cameraPitch ?? rt?.camera_pitch ?? THREE.MathUtils.degToRad(45)),
    distance: Number(rt?.cameraDistance ?? rt?.camera_distance ?? 26),
  };
}

export function readPosYawFromEntity(entity) {
  return {
    x: Number(entity?.pos?.x ?? 0),
    y: Number(entity?.pos?.y ?? 0),
    z: Number(entity?.pos?.z ?? 0),
    yaw: Number(entity?.yaw ?? 0),
  };
}

export function readEntityVitals(entity) {
  const hpCurrent = entity?.vitals?.hp?.current ?? entity?.hpCurrent ?? entity?.hp_current ?? entity?.hp ?? 0;
  const hpMax = entity?.vitals?.hp?.max ?? entity?.hpMax ?? entity?.hp_max ?? 0;
  const staminaCurrent =
    entity?.vitals?.stamina?.current ?? entity?.staminaCurrent ?? entity?.stamina_current ?? 0;
  const staminaMax =
    entity?.vitals?.stamina?.max ?? entity?.staminaMax ?? entity?.stamina_max ?? 0;
  const hungerCurrent =
    entity?.vitals?.hunger?.current ?? entity?.hungerCurrent ?? entity?.hunger_current ?? 0;
  const hungerMax =
    entity?.vitals?.hunger?.max ?? entity?.hungerMax ?? entity?.hunger_max ?? 0;
  const thirstCurrent =
    entity?.vitals?.thirst?.current ?? entity?.thirstCurrent ?? entity?.thirst_current ?? 0;
  const thirstMax =
    entity?.vitals?.thirst?.max ?? entity?.thirstMax ?? entity?.thirst_max ?? 0;

  return {
    hpCurrent: toDisplayInt(hpCurrent, 0),
    hpMax: toDisplayInt(hpMax, 0),
    staminaCurrent: toDisplayInt(staminaCurrent, 0),
    staminaMax: toDisplayInt(staminaMax, 0),
    hungerCurrent: toDisplayInt(hungerCurrent, 0),
    hungerMax: toDisplayInt(hungerMax, 0),
    thirstCurrent: toDisplayInt(thirstCurrent, 0),
    thirstMax: toDisplayInt(thirstMax, 0),
  };
}

export function readEntityStatus(entity) {
  const status = entity?.status ?? null;

  const immunityCurrent =
    status?.immunity?.current ??
    entity?.immunityCurrent ??
    entity?.immunity_current ??
    100;
  const immunityMax =
    status?.immunity?.max ??
    entity?.immunityMax ??
    entity?.immunity_max ??
    100;

  const feverCurrent =
    status?.fever?.current ??
    status?.disease?.current ??
    entity?.feverCurrent ??
    entity?.diseaseLevel ??
    entity?.disease_level ??
    100;
  const feverMax = 100;
  const feverSeverity =
    status?.fever?.severity ??
    status?.disease?.severity ??
    entity?.feverSeverity ??
    entity?.diseaseSeverity ??
    entity?.disease_severity ??
    Math.max(0, Math.min(1, 1 - Number(feverCurrent) / feverMax));

  const sleepCurrent =
    status?.sleep?.current ??
    entity?.sleepCurrent ??
    entity?.sleep_current ??
    100;
  const sleepMax =
    status?.sleep?.max ??
    entity?.sleepMax ??
    entity?.sleep_max ??
    100;

  const debuffs = status?.debuffs ?? null;
  const feverActive = Boolean(debuffs?.active) || Number(feverCurrent) < feverMax;
  const resolvedFeverTier =
    debuffs?.tier ??
    (Number(feverCurrent) >= feverMax
      ? 0
      : Math.max(1, Math.min(10, Math.ceil(Math.max(0, Math.min(1, Number(feverSeverity))) * 10))));
  const tempoMultiplier =
    debuffs?.tempoMultiplier ??
    (resolvedFeverTier <= 0
      ? 1
      : resolvedFeverTier <= 5
        ? 1 + resolvedFeverTier * 0.1
        : 1 + 5 * 0.1 + (resolvedFeverTier - 5) * 0.15);

  return {
    immunityCurrent: toDisplayInt(immunityCurrent, 100),
    immunityMax: toDisplayInt(immunityMax, 100),
    feverCurrent: toDisplayInt(feverCurrent, 100),
    feverMax,
    feverSeverity: Math.max(0, Math.min(1, Number(feverSeverity))),
    feverTier: resolvedFeverTier,
    feverTempoMultiplier: Number.isFinite(Number(tempoMultiplier)) ? Number(tempoMultiplier) : 1,
    feverStaminaRegenMultiplier:
      debuffs?.staminaRegenMultiplier ??
      (resolvedFeverTier > 0 ? 1 / (Number.isFinite(Number(tempoMultiplier)) ? Number(tempoMultiplier) : 1) : 1),
    feverActive,
    sleepCurrent: toDisplayInt(sleepCurrent, 100),
    sleepMax: toDisplayInt(sleepMax, 100),
    debuffs,
  };
}

export function isEnemyEntity(entity) {
  if (!entity) return false;
  if (entity.kind === "ENEMY") return true;
  if (!entity?.displayName) return false;

  const name = String(entity.displayName).toUpperCase();
  return (
    name.includes("RABBIT") ||
    name.includes("GOBLIN") ||
    name.includes("WOLF") ||
    name.includes("SLIME") ||
    name.includes("ORC") ||
    name.includes("SPIDER") ||
    name.startsWith("ENEMY_") ||
    name.startsWith("MONSTER_")
  );
}
