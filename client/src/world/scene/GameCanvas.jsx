import { useEffect, useRef } from "react";
import * as THREE from "three";
import { setupCamera } from "./camera/camera";
import { setupLight } from "./light/light";

export function GameCanvas({ snapshot }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const sizeX = snapshot?.localTemplate?.geometry?.size_x ?? 200;
    const sizeZ = snapshot?.localTemplate?.geometry?.size_z ?? 200;

    // =============================
    // RENDERER
    // =============================
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // =============================
    // SCENE
    // =============================
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // =============================
    // CAMERA + LIGHT (vem dos módulos)
    // =============================
    const { camera, update, onWheel, onResize, setBounds } = setupCamera(container);
    setupLight(scene);

    // Enquadra o local (como ainda não há hero)
    setBounds({ sizeX, sizeZ });

    // eventos
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", onResize);

    // =============================
    // CHÃO INVISÍVEL
    // =============================
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(sizeX, sizeZ),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // =============================
    // LIMITES (LineLoop)
    // =============================
    const halfX = sizeX / 2;
    const halfZ = sizeZ / 2;

    const y = 0.2; // ↑ sobe um pouco pra não “colar” no plano
    const pts = [
      new THREE.Vector3(-halfX, y, -halfZ),
      new THREE.Vector3( halfX, y, -halfZ),
      new THREE.Vector3( halfX, y,  halfZ),
      new THREE.Vector3(-halfX, y,  halfZ),
    ];

    const boundsGeometry = new THREE.BufferGeometry().setFromPoints(pts);
    const boundsMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const bounds = new THREE.LineLoop(boundsGeometry, boundsMaterial);
    bounds.frustumCulled = false; // debug seguro
    scene.add(bounds);

    // =============================
    // LOOP
    // =============================
    let alive = true;
    const clock = new THREE.Clock();

    const tick = () => {
      if (!alive) return;

      const dt = Math.min(clock.getDelta(), 0.05);

      // Ainda sem hero: update não faz nada, e tá certo.
      update(null, dt);

      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    // =============================
    // CLEANUP
    // =============================
    return () => {
      alive = false;

      renderer.domElement.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);

      const canvas = renderer.domElement;
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);

      renderer.dispose();

      ground.geometry.dispose();
      ground.material.dispose();

      boundsGeometry.dispose();
      boundsMaterial.dispose();
    };
  }, [snapshot]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100vw", height: "100vh", overflow: "hidden" }}
    />
  );
}
