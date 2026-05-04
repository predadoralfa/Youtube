// src/world/scene/camera/camera.js
import * as THREE from "three";

const DEFAULT_PITCH = THREE.MathUtils.degToRad(45);
const DEFAULT_DISTANCE = 26;
const MIN_DISTANCE = 6;
const MAX_DISTANCE = 55;
const MIN_PITCH = THREE.MathUtils.degToRad(15);
const MAX_PITCH = THREE.MathUtils.degToRad(80);

function clampPitch(value, minPitch = MIN_PITCH, maxPitch = MAX_PITCH) {
  return THREE.MathUtils.clamp(
    Number.isFinite(Number(value)) ? Number(value) : DEFAULT_PITCH,
    minPitch,
    maxPitch
  );
}

function clampDistance(value) {
  return THREE.MathUtils.clamp(
    Number.isFinite(Number(value)) ? Number(value) : DEFAULT_DISTANCE,
    MIN_DISTANCE,
    MAX_DISTANCE
  );
}

export function setupCamera(container, initialState = {}, options = {}) {
  if (!container) throw new Error("setupCamera: container e obrigatorio");
  const safeOptions = options ?? {};
  const safeInitialState = initialState ?? {};

  const camera = new THREE.PerspectiveCamera(
    65,
    container.clientWidth / container.clientHeight,
    0.1,
    5000
  );

  // ===== Rig (Unreal-like) =====
  const pivot = new THREE.Vector3(); // "bone" alvo (cabeca)
  const pivotHeight = Number.isFinite(Number(safeOptions.pivotHeight))
    ? Number(safeOptions.pivotHeight)
    : 2.2;
  const defaultPitch = Number.isFinite(Number(safeOptions.defaultPitch))
    ? Number(safeOptions.defaultPitch)
    : DEFAULT_PITCH;
  const defaultDistance = Number.isFinite(Number(safeOptions.defaultDistance))
    ? Number(safeOptions.defaultDistance)
    : DEFAULT_DISTANCE;
  const minPitch = Number.isFinite(Number(safeOptions.minPitch))
    ? Number(safeOptions.minPitch)
    : MIN_PITCH;
  const maxPitch = Number.isFinite(Number(safeOptions.maxPitch))
    ? Number(safeOptions.maxPitch)
    : MAX_PITCH;
  let yaw = Number.isFinite(Number(safeInitialState.yaw))
    ? Number(safeInitialState.yaw)
    : 0;
  let pitch = clampPitch(
    Number.isFinite(Number(safeInitialState.pitch)) ? safeInitialState.pitch : defaultPitch,
    minPitch,
    maxPitch
  );
  let distance = clampDistance(
    Number.isFinite(Number(safeInitialState.distance)) ? safeInitialState.distance : defaultDistance
  );
  let targetDistance = distance;

  const orbitSensitivity = 0.004; // ajuste fino
  const zoomStep = 2.4;
  const zoomSmoothness = 12;

  function setBounds({ sizeX = 200, sizeZ = 200 } = {}) {
    // so para primeira visao; nao mexe em yaw/pitch/distance
    const max = Math.max(sizeX, sizeZ);
    const d = Math.min(120, Math.max(25, max * 0.12));
    camera.position.set(0, d * 0.6, d);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }

  function normalizeZoomDelta(delta) {
    if (!Number.isFinite(delta) || delta === 0) return 0;

    // Wheel costuma vir em ~100/120 por passo; normalizamos para evitar saltos.
    return THREE.MathUtils.clamp(delta / 120, -4, 4);
  }

  function applyZoom(delta) {
    const zoomDelta = normalizeZoomDelta(delta);
    if (zoomDelta === 0) return;

    const dynamicStep = zoomStep + targetDistance * 0.06;
    targetDistance = THREE.MathUtils.clamp(
      targetDistance + zoomDelta * dynamicStep,
      MIN_DISTANCE,
      MAX_DISTANCE
    );
  }

  function applyOrbit(deltaX, deltaY) {
    yaw -= deltaX * orbitSensitivity;
    pitch -= deltaY * orbitSensitivity;
    pitch = clampPitch(pitch, minPitch, maxPitch);
  }

  function update(hero, dt = 0) {
    if (!hero) return;

    const lerpAlpha = 1 - Math.exp(-zoomSmoothness * Math.max(0, dt || 0));
    distance = THREE.MathUtils.lerp(
      distance,
      targetDistance,
      dt > 0 ? lerpAlpha : 0.2
    );

    // "bone": cabeca do cilindro (ajuste fino)
    pivot.copy(hero.position);
    pivot.y += pivotHeight;

    // offset esferico (orbit)
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);

    const offset = new THREE.Vector3(
      distance * cosP * sinY,
      distance * sinP,
      distance * cosP * cosY
    );

    // atras do alvo (invertendo Z do offset)
    camera.position.copy(pivot).add(offset);
    camera.lookAt(pivot);
  }

  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // Mantem compatibilidade com seu onWheel atual, se quiser
  function onWheel(e) {
    e.preventDefault();
    applyZoom(e.deltaY);
  }

  function getYaw() {
    return yaw;
  }

  function getState() {
    return {
      yaw,
      pitch,
      distance: targetDistance,
    };
  }

  return {
    camera,
    update,
    applyOrbit,
    applyZoom,
    onWheel,
    onResize,
    setBounds,
    getYaw,
    getState,
  };
}
