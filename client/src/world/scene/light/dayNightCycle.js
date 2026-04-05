import * as THREE from "three";

const DAWN_START_HOUR = 4;
const DAY_START_HOUR = 5;
const DUSK_START_HOUR = 18.5;
const NIGHT_START_HOUR = 20;

const CLEAR_SKY_COLOR = new THREE.Color("#8fd3ff");
const DARK_SKY_COLOR = new THREE.Color("#050816");
const CLEAR_FOG_COLOR = new THREE.Color("#b7e7ff");
const DARK_FOG_COLOR = new THREE.Color("#03050c");
const CLEAR_HEMI_SKY = new THREE.Color("#f5fbff");
const DARK_HEMI_SKY = new THREE.Color("#102033");
const CLEAR_HEMI_GROUND = new THREE.Color("#3c3428");
const DARK_HEMI_GROUND = new THREE.Color("#050608");
const CLEAR_SUN_COLOR = new THREE.Color("#fff3d6");
const DARK_SUN_COLOR = new THREE.Color("#6b7da6");
const CLEAR_SUN_POSITION = new THREE.Vector3(15, 25, 10);
const DARK_SUN_POSITION = new THREE.Vector3(-8, 6, -14);

function mixNumber(from, to, alpha) {
  return from + (to - from) * alpha;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function smoothstep(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function resolveHourValue(worldTime) {
  const hour = Number(worldTime?.hour ?? 0);
  const minute = Number(worldTime?.minute ?? 0);
  return hour + minute / 60;
}

export function resolveDayNightFactor(worldTime) {
  const hourValue = resolveHourValue(worldTime);

  if (hourValue >= DAY_START_HOUR && hourValue < DUSK_START_HOUR) {
    return 0;
  }

  if (hourValue >= NIGHT_START_HOUR || hourValue < DAWN_START_HOUR) {
    return 1;
  }

  if (hourValue >= DAWN_START_HOUR && hourValue < DAY_START_HOUR) {
    return 1 - smoothstep((hourValue - DAWN_START_HOUR) / (DAY_START_HOUR - DAWN_START_HOUR));
  }

  if (hourValue >= DUSK_START_HOUR && hourValue < NIGHT_START_HOUR) {
    return smoothstep((hourValue - DUSK_START_HOUR) / (NIGHT_START_HOUR - DUSK_START_HOUR));
  }

  return 1;
}

export function applyDayNightCycle({
  scene,
  renderer,
  hemiLight,
  dirLight,
  worldTime,
}) {
  if (!scene || !renderer || !hemiLight || !dirLight) return;

  const factor = resolveDayNightFactor(worldTime);

  if (!scene.fog) {
    scene.fog = new THREE.Fog(CLEAR_FOG_COLOR.clone(), 45, 180);
  }

  scene.background = CLEAR_SKY_COLOR.clone().lerp(DARK_SKY_COLOR, factor);
  scene.fog.color.copy(CLEAR_FOG_COLOR).lerp(DARK_FOG_COLOR, factor);
  scene.fog.near = mixNumber(45, 20, factor);
  scene.fog.far = mixNumber(180, 85, factor);

  hemiLight.color.copy(CLEAR_HEMI_SKY).lerp(DARK_HEMI_SKY, factor);
  hemiLight.groundColor.copy(CLEAR_HEMI_GROUND).lerp(DARK_HEMI_GROUND, factor);
  hemiLight.intensity = mixNumber(1.15, 0.18, factor);

  dirLight.color.copy(CLEAR_SUN_COLOR).lerp(DARK_SUN_COLOR, factor);
  dirLight.intensity = mixNumber(1.0, 0.12, factor);
  dirLight.position.copy(CLEAR_SUN_POSITION).lerp(DARK_SUN_POSITION, factor);

  renderer.toneMappingExposure = mixNumber(1.0, 0.42, factor);

  return factor;
}
