// src/world/scene/camera/camera.js
import * as THREE from "three";

export function setupCamera(container) {
  if (!container) throw new Error("setupCamera: container é obrigatório");

  const camera = new THREE.PerspectiveCamera(
    65,
    container.clientWidth / container.clientHeight,
    0.1,
    5000
  );

  // ===== Rig (Unreal-like) =====
  const pivot = new THREE.Vector3(); // "bone" alvo (cabeça)
  let yaw = 0;                       // rot horizontal
  let pitch = THREE.MathUtils.degToRad(45); // 45° default
  let distance = 35;

  const minDistance = 10;
  const maxDistance = 90;

  const minPitch = THREE.MathUtils.degToRad(15);  // não deixa virar topdown puro
  const maxPitch = THREE.MathUtils.degToRad(80);  // não deixa olhar de baixo

  const orbitSensitivity = 0.004; // ajuste fino
  const zoomStep = 4.0;

  function setBounds({ sizeX = 200, sizeZ = 200 } = {}) {
    // só para primeira visão; não mexe em yaw/pitch/distance
    const max = Math.max(sizeX, sizeZ);
    const d = Math.min(120, Math.max(25, max * 0.12));
    camera.position.set(0, d * 0.6, d);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }

  function applyZoom(dir) {
    distance = THREE.MathUtils.clamp(distance + dir * zoomStep, minDistance, maxDistance);
  }

  function applyOrbit(deltaX, deltaY) {
    yaw -= deltaX * orbitSensitivity;
    pitch -= deltaY * orbitSensitivity;
    pitch = THREE.MathUtils.clamp(pitch, minPitch, maxPitch);
  }

  function update(hero, dt = 0) {
    if (!hero) return;

    // "bone": cabeça do cilindro (ajuste fino)
    pivot.copy(hero.position);
    pivot.y += 2.2;

    // offset esférico (orbit)
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);

    const offset = new THREE.Vector3(
      distance * cosP * sinY,
      distance * sinP,
      distance * cosP * cosY
    );

    // atrás do alvo (invertendo Z do offset)
    camera.position.copy(pivot).add(offset);
    camera.lookAt(pivot);
  }

  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // Mantém compatibilidade com seu onWheel atual, se quiser
  function onWheel(e) {
    e.preventDefault();
    applyZoom(Math.sign(e.deltaY));
  }

  function getYaw() {
  return yaw;
}



  return { camera, update, applyOrbit, applyZoom, onWheel, onResize, setBounds, getYaw };
}
