import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";

function normalizeDayProgress(worldClock) {
  if (!worldClock || typeof worldClock !== "object") return 0.5;

  const candidates = [
    worldClock.dayProgress,
    worldClock.day_progress,
    worldClock.normalizedDayTime,
    worldClock.normalized_day_time,
  ];

  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n)) {
      return THREE.MathUtils.clamp(n, 0, 1);
    }
  }

  const hour = Number(worldClock.hour ?? worldClock.gameHour);
  if (Number.isFinite(hour)) {
    return THREE.MathUtils.clamp(hour / 24, 0, 1);
  }

  return 0.5;
}

export function createSkyDome(scene, renderer) {
  const sky = new Sky();
  sky.scale.setScalar(450000);
  sky.frustumCulled = false;
  scene.add(sky);

  const sun = new THREE.Vector3();
  const uniforms = sky.material.uniforms;
  uniforms.turbidity.value = 10;
  uniforms.rayleigh.value = 3;
  uniforms.mieCoefficient.value = 0.005;
  uniforms.mieDirectionalG.value = 0.7;

  if ("cloudCoverage" in uniforms) uniforms.cloudCoverage.value = 0.4;
  if ("cloudDensity" in uniforms) uniforms.cloudDensity.value = 0.4;
  if ("cloudElevation" in uniforms) uniforms.cloudElevation.value = 0.5;
  if ("showSunDisc" in uniforms) uniforms.showSunDisc.value = true;

  if (renderer) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.5;
  }

  function updateSunPosition({ elevation = 2, azimuth = 180 } = {}) {
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);

    sun.setFromSphericalCoords(1, phi, theta);
    sky.material.uniforms.sunPosition.value.copy(sun);
  }

  function updateBySunAngles({ elevation = 2, azimuth = 180, exposure } = {}) {
    updateSunPosition({ elevation, azimuth });

    if (renderer && Number.isFinite(exposure)) {
      renderer.toneMappingExposure = exposure;
    }
  }

  function updateByWorldClock(worldClock) {
    const dayProgress = normalizeDayProgress(worldClock);
    const rawElevation = Math.sin(dayProgress * Math.PI * 2 - Math.PI / 2) * 75;
    const elevation = Math.max(-8, rawElevation);
    const azimuth = 180;

    const daylight = THREE.MathUtils.clamp((elevation + 8) / 83, 0.08, 1);
    const exposure = THREE.MathUtils.lerp(0.25, 0.9, daylight);

    updateBySunAngles({ elevation, azimuth, exposure });
    if ("time" in uniforms) {
      uniforms.time.value = performance.now() * 0.001;
    }
  }

  function dispose() {
    scene.remove(sky);

    if (sky.geometry) {
      sky.geometry.dispose();
    }

    if (sky.material) {
      sky.material.dispose();
    }
  }

  updateByWorldClock(null);

  return {
    sky,
    sun,
    updateBySunAngles,
    updateByWorldClock,
    dispose,
  };
}
