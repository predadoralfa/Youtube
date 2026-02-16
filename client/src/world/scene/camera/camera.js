import * as THREE from "three";

export function setupCamera(container) {
  if (!container) throw new Error("setupCamera: container é obrigatório");

  const camera = new THREE.PerspectiveCamera(
    65,
    container.clientWidth / container.clientHeight,
    0.1,
    5000 // ↑ era 1000, com local 1000x1000 fica apertado
  );

  // Posição inicial fixa (debug)
  camera.position.set(6, 6, 6);
  camera.lookAt(0, 0, 0);

  let distance = 8.0;
  const minDistance = 3.5;
  const maxDistance = 8000.0; // ↑ para mundos grandes
  const zoomStep = 1.0;

  const up = new THREE.Vector3(0, 1, 0);
  const forward = new THREE.Vector3();
  const target = new THREE.Vector3();
  const desired = new THREE.Vector3();

  // ✅ novo: enquadrar bounds quando não existe hero
  function setBounds({ sizeX = 200, sizeZ = 200 } = {}) {
    const max = Math.max(sizeX, sizeZ);
    const d = Math.max(12, max * 0.9);

    distance = THREE.MathUtils.clamp(d, minDistance, maxDistance);

    camera.position.set(0, distance * 0.6, distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }

  function update(hero, dt = 0) {
    // Se não houver hero, mantém câmera fixa (bounds)
    if (!hero) return;

    forward.set(0, 0, 1).applyAxisAngle(up, hero.rotation.y).normalize();

    target.copy(hero.position);
    target.y += 1.2;

    desired.copy(target);
    desired.addScaledVector(forward, -distance);
    desired.y += 2.2;

    camera.position.lerp(desired, 0.12);
    camera.lookAt(target);
  }

  function onWheel(e) {
    e.preventDefault();
    const dir = Math.sign(e.deltaY);
    distance = THREE.MathUtils.clamp(
      distance + dir * zoomStep,
      minDistance,
      maxDistance
    );
  }

  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  return { camera, update, onWheel, onResize, setBounds };
}
